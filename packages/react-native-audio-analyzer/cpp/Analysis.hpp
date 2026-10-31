#pragma once

#include "PeaksAccumulator.hpp"

#include <atomic>
#include <cstdint>
#include <functional>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <variant>
#include <vector>

namespace audioanalyzer {

/** An absolute file path, or an encoded audio file held in memory. */
using AudioSource = std::variant<std::string, std::shared_ptr<const std::vector<std::uint8_t>>>;

struct AudioInfo {
  std::string format;
  /** `"builtin"` or `"platform"`. */
  std::string decoder;
  std::uint32_t sampleRate = 0;
  std::uint32_t channels = 0;
  std::uint64_t frames = 0;
};

struct AnalyzeOptions {
  /** Exact bucket size; 0 derives it from `maxBuckets` (see autoFramesPerBucket). */
  std::uint64_t framesPerBucket = 0;
  /** Upper bound on the number of buckets when `framesPerBucket` is 0. */
  std::uint64_t maxBuckets = 100000;
  bool splitChannels = false;
  /** Start of the range in seconds. */
  double startTime = 0;
  /** End of the range in seconds (exclusive); std::nullopt means the end of the file. */
  std::optional<double> endTime;
};

struct AnalysisResult {
  std::uint32_t sampleRate = 0;
  std::uint64_t startFrame = 0;
  PeaksData peaks;
};

/** Thrown by analyze() when the cancellation flag is set. */
struct AnalysisCancelled : std::runtime_error {
  AnalysisCancelled() : std::runtime_error("Analysis was cancelled") {}
};

/** Bucket size for `frames`: 256 frames, raised so that there are at most `maxBuckets` buckets. */
std::uint64_t autoFramesPerBucket(std::uint64_t frames, std::uint64_t maxBuckets);

/**
 * Reads format, sample rate, channel count and length. If the format cannot
 * report its length up front, the file is decoded once to count frames.
 */
AudioInfo readInfo(const AudioSource& source);

/**
 * Decodes the requested range in chunks and returns per-bucket statistics.
 * Memory use is bounded by the chunk size plus the result.
 *
 * `cancelled` is polled between chunks; when it becomes true, AnalysisCancelled
 * is thrown. `onProgress` receives the analyzed fraction (0…1) in steps of at
 * least 1% and always ends with 1.
 *
 * Throws std::invalid_argument for an invalid range and std::runtime_error if
 * the source cannot be opened or decoded.
 */
AnalysisResult analyze(const AudioSource& source, const AnalyzeOptions& options,
                       const std::atomic<bool>* cancelled = nullptr,
                       const std::function<void(double)>& onProgress = nullptr);

class AudioDecoder;

/**
 * analyze() on an already opened decoder. The decoder's length is treated as
 * an estimate (container metadata can be off by a codec frame or more): it
 * sizes buckets and progress, while a range without `endTime` is read until
 * the decoder reports the end of the stream.
 */
AnalysisResult analyzeDecoder(AudioDecoder& decoder, const AnalyzeOptions& options,
                              const std::atomic<bool>* cancelled = nullptr,
                              const std::function<void(double)>& onProgress = nullptr);

} // namespace audioanalyzer
