#pragma once

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <stdexcept>
#include <vector>

namespace audioanalyzer {

/**
 * Per-bucket statistics for one or more channels. Every vector holds
 * `length * channels` values, channel-major: all buckets of channel 0, then
 * channel 1, and so on.
 */
struct PeaksData {
  std::uint32_t channels = 0;
  std::uint64_t framesPerBucket = 0;
  /** Number of frames that went into the buckets; the last bucket may be partial. */
  std::uint64_t frameCount = 0;
  /** Buckets per channel. */
  std::size_t length = 0;
  std::vector<float> min;  // smallest sample (signed)
  std::vector<float> max;  // largest sample (signed)
  std::vector<float> rms; // sqrt(mean(x^2))
};

/**
 * Streams interleaved float PCM into fixed-size buckets of `framesPerBucket`
 * frames and computes min, max and RMS per bucket in a single pass, with O(1)
 * state per channel.
 *
 * With `splitChannels == false` all channels are aggregated into one output
 * channel: min/max are taken over every sample of every channel, RMS over all
 * of them. Channels are *not* summed, so out-of-phase stereo does not
 * cancel out.
 */
class PeaksAccumulator {
public:
  PeaksAccumulator(std::uint32_t sourceChannels, std::uint64_t framesPerBucket, bool splitChannels,
                   std::uint64_t expectedFrames = 0)
      : _sourceChannels(sourceChannels), _framesPerBucket(framesPerBucket), _split(splitChannels),
        _outputChannels(splitChannels ? sourceChannels : 1) {
    if (sourceChannels == 0) {
      throw std::invalid_argument("PeaksAccumulator: channels must be greater than 0");
    }
    if (framesPerBucket == 0) {
      throw std::invalid_argument("PeaksAccumulator: framesPerBucket must be greater than 0");
    }
    _current.resize(_outputChannels);
    _channels.resize(_outputChannels);
    if (expectedFrames > 0) {
      const std::size_t buckets = static_cast<std::size_t>((expectedFrames + framesPerBucket - 1) / framesPerBucket);
      for (auto& channel : _channels) {
        channel.min.reserve(buckets);
        channel.max.reserve(buckets);
        channel.rms.reserve(buckets);
      }
    }
    reset();
  }

  /** Adds `frameCount` interleaved frames (`frameCount * sourceChannels` samples). */
  void push(const float* interleaved, std::uint64_t frameCount) {
    std::uint64_t offset = 0;
    while (offset < frameCount) {
      // Process the longest run that stays inside the current bucket.
      const std::uint64_t run = std::min(frameCount - offset, _framesPerBucket - _framesInBucket);
      const float* samples = interleaved + offset * _sourceChannels;
      if (_split) {
        for (std::uint32_t channel = 0; channel < _sourceChannels; ++channel) {
          accumulate(_current[channel], samples + channel, run, _sourceChannels);
        }
      } else {
        // Aggregated channels: every sample of the run counts the same.
        accumulate(_current[0], samples, run * _sourceChannels, 1);
      }
      offset += run;
      _frameCount += run;
      _framesInBucket += run;
      if (_framesInBucket == _framesPerBucket) {
        flush();
      }
    }
  }

  std::uint64_t frameCount() const noexcept {
    return _frameCount;
  }

  /** Completes the last (possibly partial) bucket and returns the result. Call once. */
  PeaksData finish() {
    if (_framesInBucket > 0) {
      flush();
    }
    PeaksData data;
    data.channels = _outputChannels;
    data.framesPerBucket = _framesPerBucket;
    data.frameCount = _frameCount;
    data.length = _channels.empty() ? 0 : _channels[0].min.size();
    // Concatenate per-channel vectors into the channel-major layout. A single
    // channel is already in that layout and is moved without copying.
    auto concat = [&](std::vector<float> Channel::*field, std::vector<float>& out) {
      if (_channels.size() == 1) {
        out = std::move(_channels[0].*field);
        return;
      }
      out.reserve(data.length * _outputChannels);
      for (const auto& channel : _channels) {
        const std::vector<float>& values = channel.*field;
        out.insert(out.end(), values.begin(), values.end());
      }
    };
    concat(&Channel::min, data.min);
    concat(&Channel::max, data.max);
    concat(&Channel::rms, data.rms);
    return data;
  }

private:
  struct Running {
    float min;
    float max;
    double sumSquares;
    std::uint64_t count;
  };

  struct Channel {
    std::vector<float> min;
    std::vector<float> max;
    std::vector<float> rms;
  };

  // Folds `count` samples spaced `stride` apart into `running`. Four
  // independent accumulators break the dependency chains so the CPU can
  // overlap iterations; runs are at most one chunk long, so float partial sums
  // are exact enough before they are added to the double totals.
  static void accumulate(Running& running, const float* samples, std::uint64_t count, std::size_t stride) {
    float lo[4] = {running.min, running.min, running.min, running.min};
    float hi[4] = {running.max, running.max, running.max, running.max};
    float squares[4] = {0, 0, 0, 0};
    std::uint64_t i = 0;
    for (; i + 4 <= count; i += 4) {
      for (int lane = 0; lane < 4; ++lane) {
        const float x = samples[(i + static_cast<std::uint64_t>(lane)) * stride];
        lo[lane] = x < lo[lane] ? x : lo[lane];
        hi[lane] = x > hi[lane] ? x : hi[lane];
        squares[lane] += x * x;
      }
    }
    for (; i < count; ++i) {
      const float x = samples[i * stride];
      lo[0] = x < lo[0] ? x : lo[0];
      hi[0] = x > hi[0] ? x : hi[0];
      squares[0] += x * x;
    }
    running.min = std::min(std::min(lo[0], lo[1]), std::min(lo[2], lo[3]));
    running.max = std::max(std::max(hi[0], hi[1]), std::max(hi[2], hi[3]));
    running.sumSquares += static_cast<double>(squares[0]) + squares[1] + squares[2] + squares[3];
    running.count += count;
  }

  void flush() {
    for (std::uint32_t channel = 0; channel < _outputChannels; ++channel) {
      const Running& running = _current[channel];
      Channel& out = _channels[channel];
      const double count = static_cast<double>(running.count);
      out.min.push_back(running.min);
      out.max.push_back(running.max);
      out.rms.push_back(static_cast<float>(std::sqrt(running.sumSquares / count)));
    }
    reset();
  }

  void reset() {
    for (auto& running : _current) {
      running = Running{std::numeric_limits<float>::infinity(), -std::numeric_limits<float>::infinity(), 0.0, 0};
    }
    _framesInBucket = 0;
  }

  std::uint32_t _sourceChannels;
  std::uint64_t _framesPerBucket;
  bool _split;
  std::uint32_t _outputChannels;
  std::vector<Running> _current;
  std::vector<Channel> _channels;
  std::uint64_t _framesInBucket = 0;
  std::uint64_t _frameCount = 0;
};

} // namespace audioanalyzer
