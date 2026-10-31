#include "Analysis.hpp"

#include "AudioDecoder.hpp"

#include <algorithm>
#include <cmath>
#include <limits>
#include <string>

namespace audioanalyzer {

namespace {

constexpr std::uint64_t kChunkFrames = 4096;
constexpr std::uint64_t kMinFramesPerBucket = 256;
// Hard cap on buckets × channels (12 bytes each, ~360 MB): protects against
// options like framesPerBucket = 1 on long files.
constexpr std::uint64_t kMaxTotalBuckets = 30'000'000;

std::unique_ptr<AudioDecoder> open(const AudioSource& source) {
  if (const auto* path = std::get_if<std::string>(&source)) {
    return AudioDecoder::openFile(*path);
  }
  return AudioDecoder::openMemory(std::get<std::shared_ptr<const std::vector<std::uint8_t>>>(source));
}

void throwIfCancelled(const std::atomic<bool>* cancelled) {
  if (cancelled && cancelled->load(std::memory_order_relaxed)) {
    throw AnalysisCancelled();
  }
}

// Some formats cannot report their length up front; count the frames with an
// extra decoding pass instead of buffering the whole file.
std::uint64_t lengthOf(AudioDecoder& decoder, const std::atomic<bool>* cancelled = nullptr) {
  if (const auto length = decoder.lengthInFrames()) {
    return *length;
  }
  std::vector<float> buffer(static_cast<std::size_t>(kChunkFrames) * decoder.channels());
  std::uint64_t total = 0;
  while (const std::uint64_t read = decoder.read(buffer.data(), kChunkFrames)) {
    total += read;
    throwIfCancelled(cancelled);
  }
  decoder.seek(0, cancelled);
  throwIfCancelled(cancelled);
  return total;
}

std::uint64_t secondsToFrame(double seconds, std::uint32_t sampleRate) {
  return static_cast<std::uint64_t>(std::llround(seconds * static_cast<double>(sampleRate)));
}

} // namespace

std::uint64_t autoFramesPerBucket(std::uint64_t frames, std::uint64_t maxBuckets) {
  if (maxBuckets == 0) {
    throw std::invalid_argument("maxBuckets must be greater than 0");
  }
  const std::uint64_t forLength = (frames + maxBuckets - 1) / maxBuckets;
  return std::max(kMinFramesPerBucket, forLength);
}

AudioInfo readInfo(const AudioSource& source) {
  auto decoder = open(source);
  AudioInfo info;
  info.format = decoder->format();
  info.decoder = decoder->decoder();
  info.sampleRate = decoder->sampleRate();
  info.channels = decoder->channels();
  info.frames = lengthOf(*decoder);
  return info;
}

namespace {

void validate(const AnalyzeOptions& options) {
  if (!std::isfinite(options.startTime) || options.startTime < 0) {
    throw std::invalid_argument("start must be a finite number >= 0");
  }
  if (options.endTime && (!std::isfinite(*options.endTime) || *options.endTime < options.startTime)) {
    throw std::invalid_argument("end must be a finite number >= start");
  }
}

} // namespace

AnalysisResult analyze(const AudioSource& source, const AnalyzeOptions& options, const std::atomic<bool>* cancelled,
                       const std::function<void(double)>& onProgress) {
  validate(options);
  auto decoder = open(source);
  return analyzeDecoder(*decoder, options, cancelled, onProgress);
}

AnalysisResult analyzeDecoder(AudioDecoder& decoder, const AnalyzeOptions& options,
                              const std::atomic<bool>* cancelled, const std::function<void(double)>& onProgress) {
  validate(options);
  const std::uint32_t channels = decoder.channels();
  const std::uint32_t sampleRate = decoder.sampleRate();
  if (channels == 0 || sampleRate == 0) {
    throw std::runtime_error("Audio source reports no channels or no sample rate");
  }

  throwIfCancelled(cancelled);
  // An estimate: see analyzeDecoder() in the header.
  const std::uint64_t total = lengthOf(decoder, cancelled);
  throwIfCancelled(cancelled);
  const std::uint64_t startFrame = std::min(secondsToFrame(options.startTime, sampleRate), total);
  // Hard stop: the requested end, or the end of the stream.
  const std::uint64_t limitFrame =
      options.endTime ? secondsToFrame(*options.endTime, sampleRate) : std::numeric_limits<std::uint64_t>::max();
  const std::uint64_t expectedEnd = std::min(limitFrame, total);
  const std::uint64_t rangeFrames = expectedEnd > startFrame ? expectedEnd - startFrame : 0;
  if (rangeFrames == 0) {
    // Nothing to decode (e.g. a start beyond the end): don't seek at all.
    AnalysisResult empty;
    empty.sampleRate = sampleRate;
    empty.startFrame = startFrame;
    const std::uint64_t framesPerBucket =
        options.framesPerBucket > 0 ? options.framesPerBucket : autoFramesPerBucket(0, options.maxBuckets);
    empty.peaks = PeaksAccumulator(channels, framesPerBucket, options.splitChannels).finish();
    if (onProgress) onProgress(1.0);
    return empty;
  }
  if (startFrame > 0) {
    decoder.seek(startFrame, cancelled);
    throwIfCancelled(cancelled);
  }

  const std::uint64_t framesPerBucket =
      options.framesPerBucket > 0 ? options.framesPerBucket : autoFramesPerBucket(rangeFrames, options.maxBuckets);
  const std::uint64_t outputChannels = options.splitChannels ? channels : 1;
  const std::uint64_t buckets = (rangeFrames + framesPerBucket - 1) / framesPerBucket;
  if (buckets * outputChannels > kMaxTotalBuckets) {
    throw std::invalid_argument("The requested resolution needs " + std::to_string(buckets * outputChannels) +
                                " buckets, more than the limit of " + std::to_string(kMaxTotalBuckets) +
                                "; use a larger framesPerBucket or a smaller range");
  }
  PeaksAccumulator accumulator(channels, framesPerBucket, options.splitChannels, rangeFrames);
  // Frames past the estimate are still analyzed, up to the same bucket cap.
  const std::uint64_t maxFrames = std::min(limitFrame - startFrame, kMaxTotalBuckets / outputChannels * framesPerBucket);

  std::vector<float> buffer(static_cast<std::size_t>(kChunkFrames) * channels);
  double reported = 0;
  while (accumulator.frameCount() < limitFrame - startFrame) {
    throwIfCancelled(cancelled);
    const std::uint64_t wanted = std::min(kChunkFrames, limitFrame - startFrame - accumulator.frameCount());
    const std::uint64_t read = decoder.read(buffer.data(), wanted);
    if (read == 0) {
      break; // End of the stream (possibly before the estimate).
    }
    accumulator.push(buffer.data(), read);
    if (accumulator.frameCount() > maxFrames) {
      throw std::invalid_argument("The audio is longer than its header states and needs more than " +
                                  std::to_string(kMaxTotalBuckets) + " buckets; use a larger framesPerBucket");
    }

    if (onProgress) {
      // The estimate may be short: hold just below 1 until the end.
      const double fraction = std::min(
          0.99, static_cast<double>(accumulator.frameCount()) / static_cast<double>(rangeFrames));
      if (fraction - reported >= 0.01) {
        reported = fraction;
        onProgress(fraction);
      }
    }
  }
  if (onProgress && reported < 1.0) {
    onProgress(1.0);
  }

  AnalysisResult result;
  result.sampleRate = sampleRate;
  result.startFrame = startFrame;
  result.peaks = accumulator.finish();
  return result;
}

} // namespace audioanalyzer
