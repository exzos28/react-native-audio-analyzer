#pragma once

#include "HybridAudioAnalyzerSpec.hpp"

#include <atomic>
#include <cstdint>
#include <memory>
#include <mutex>
#include <unordered_map>

namespace margelo::nitro::audioanalyzer {

/**
 * Nitro binding for the `AudioAnalyzer` hybrid object. All the work happens in
 * the platform-independent core (Analysis.hpp); this class converts arguments
 * coming from JS, moves the work off the JS thread and tracks running jobs so
 * they can be cancelled.
 */
class HybridAudioAnalyzer : public HybridAudioAnalyzerSpec {
public:
  HybridAudioAnalyzer() : HybridObject(TAG) {}

  std::shared_ptr<Promise<NativeAudioInfo>> getInfo(const std::variant<std::shared_ptr<ArrayBuffer>, std::string>& source) override;

  std::shared_ptr<Promise<NativePeaks>> analyze(double jobId, const std::variant<std::shared_ptr<ArrayBuffer>, std::string>& source,
                                                const NativeAnalyzeOptions& options,
                                                const std::optional<std::function<void(double)>>& onProgress) override;

  void cancel(double jobId) override;

private:
  std::mutex _jobsMutex;
  std::unordered_map<std::int64_t, std::shared_ptr<std::atomic<bool>>> _jobs;
};

} // namespace margelo::nitro::audioanalyzer
