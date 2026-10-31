#include "HybridAudioAnalyzer.hpp"

#include "Analysis.hpp"

#include <cmath>
#include <cstdint>
#include <cstring>
#include <limits>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace margelo::nitro::audioanalyzer {

namespace core = ::audioanalyzer;

namespace {

using JSSource = std::variant<std::shared_ptr<ArrayBuffer>, std::string>;

// Must run on the JS thread: a JS-owned ArrayBuffer may only be read there, so
// its bytes are copied before the work moves to a background thread.
core::AudioSource toCoreSource(const JSSource& source) {
  if (const auto* path = std::get_if<std::string>(&source)) {
    return *path;
  }
  const auto& buffer = std::get<std::shared_ptr<ArrayBuffer>>(source);
  const std::uint8_t* data = buffer ? buffer->data() : nullptr;
  if (data == nullptr) {
    throw std::invalid_argument("The audio ArrayBuffer is no longer available");
  }
  return std::make_shared<const std::vector<std::uint8_t>>(data, data + buffer->size());
}

bool isWholeNumber(double value, double min) {
  return std::isfinite(value) && value >= min && std::floor(value) == value &&
         value <= static_cast<double>(std::numeric_limits<std::uint32_t>::max());
}

// Hands the vector's storage to JS without copying it.
std::shared_ptr<ArrayBuffer> toArrayBuffer(std::vector<float>&& values) {
  if (values.empty()) {
    return ArrayBuffer::allocate(0);
  }
  auto* owned = new std::vector<float>(std::move(values));
  return ArrayBuffer::wrap(reinterpret_cast<std::uint8_t*>(owned->data()), owned->size() * sizeof(float),
                           [owned]() { delete owned; });
}

} // namespace

std::shared_ptr<Promise<NativeAudioInfo>> HybridAudioAnalyzer::getInfo(const JSSource& source) {
  core::AudioSource coreSource = toCoreSource(source);
  return Promise<NativeAudioInfo>::async([coreSource = std::move(coreSource)]() {
    const core::AudioInfo info = core::readInfo(coreSource);
    return NativeAudioInfo(info.format, info.decoder, static_cast<double>(info.sampleRate),
                           static_cast<double>(info.channels), static_cast<double>(info.frames));
  });
}

std::shared_ptr<Promise<NativePeaks>> HybridAudioAnalyzer::analyze(double jobId, const JSSource& source,
                                                                   const NativeAnalyzeOptions& options,
                                                                   const std::optional<std::function<void(double)>>& onProgress) {
  // The JS wrapper validates all of this too; check again because the values
  // are cast to unsigned integers below.
  if (!isWholeNumber(options.framesPerBucket, 0)) {
    throw std::invalid_argument("framesPerBucket must be a whole number >= 0");
  }
  if (!isWholeNumber(options.maxBuckets, 1)) {
    throw std::invalid_argument("maxBuckets must be a whole number >= 1");
  }
  if (!std::isfinite(jobId)) {
    throw std::invalid_argument("jobId must be finite");
  }

  core::AnalyzeOptions coreOptions;
  coreOptions.framesPerBucket = static_cast<std::uint64_t>(options.framesPerBucket);
  coreOptions.maxBuckets = static_cast<std::uint64_t>(options.maxBuckets);
  coreOptions.splitChannels = options.splitChannels;
  coreOptions.startTime = options.startTime;
  if (options.endTime >= 0) {
    coreOptions.endTime = options.endTime;
  }

  core::AudioSource coreSource = toCoreSource(source);
  const auto id = static_cast<std::int64_t>(jobId);
  auto cancelled = std::make_shared<std::atomic<bool>>(false);
  {
    std::lock_guard lock(_jobsMutex);
    _jobs[id] = cancelled;
  }

  std::function<void(double)> progress = onProgress.value_or(nullptr);
  // Keep this object alive while the job runs, even if JS drops it.
  auto self = shared_cast<HybridAudioAnalyzer>();
  return Promise<NativePeaks>::async([self, id, cancelled, coreSource = std::move(coreSource), coreOptions,
                                      progress = std::move(progress)]() {
    // Unregister the job however the analysis ends.
    struct Unregister {
      HybridAudioAnalyzer* self;
      std::int64_t id;
      ~Unregister() {
        std::lock_guard lock(self->_jobsMutex);
        self->_jobs.erase(id);
      }
    } unregister{self.get(), id};

    core::AnalysisResult result = core::analyze(coreSource, coreOptions, cancelled.get(), progress);
    core::PeaksData& peaks = result.peaks;
    return NativePeaks(static_cast<double>(result.sampleRate), static_cast<double>(peaks.channels),
                       static_cast<double>(peaks.framesPerBucket), static_cast<double>(result.startFrame),
                       static_cast<double>(peaks.frameCount), static_cast<double>(peaks.length),
                       toArrayBuffer(std::move(peaks.min)), toArrayBuffer(std::move(peaks.max)),
                       toArrayBuffer(std::move(peaks.rms)));
  });
}

void HybridAudioAnalyzer::cancel(double jobId) {
  if (!std::isfinite(jobId)) {
    return;
  }
  std::lock_guard lock(_jobsMutex);
  if (const auto job = _jobs.find(static_cast<std::int64_t>(jobId)); job != _jobs.end()) {
    job->second->store(true, std::memory_order_relaxed);
  }
}

} // namespace margelo::nitro::audioanalyzer
