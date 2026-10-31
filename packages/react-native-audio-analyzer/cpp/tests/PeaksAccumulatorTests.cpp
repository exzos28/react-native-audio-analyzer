#include "PeaksAccumulator.hpp"
#include "TestHarness.hpp"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <random>
#include <vector>

using audioanalyzer::PeaksAccumulator;
using audioanalyzer::PeaksData;

namespace {

std::vector<float> randomSignal(std::size_t samples, std::uint32_t seed) {
  std::mt19937 rng(seed);
  std::uniform_real_distribution<float> dist(-1.0f, 1.0f);
  std::vector<float> out(samples);
  for (auto& sample : out) sample = dist(rng);
  return out;
}

PeaksData accumulate(const std::vector<float>& interleaved, std::uint32_t channels, std::uint64_t framesPerBucket,
                     bool split, std::uint64_t chunkFrames) {
  const std::uint64_t frames = interleaved.size() / channels;
  PeaksAccumulator accumulator(channels, framesPerBucket, split, frames);
  for (std::uint64_t offset = 0; offset < frames; offset += chunkFrames) {
    accumulator.push(interleaved.data() + offset * channels, std::min(chunkFrames, frames - offset));
  }
  return accumulator.finish();
}

// Straightforward reference implementation: recompute every bucket from scratch.
PeaksData naive(const std::vector<float>& interleaved, std::uint32_t channels, std::uint64_t framesPerBucket,
                bool split) {
  const std::uint64_t frames = interleaved.size() / channels;
  const std::uint32_t outChannels = split ? channels : 1;
  PeaksData data;
  data.channels = outChannels;
  data.framesPerBucket = framesPerBucket;
  data.frameCount = frames;
  data.length = static_cast<std::size_t>((frames + framesPerBucket - 1) / framesPerBucket);
  for (std::uint32_t out = 0; out < outChannels; ++out) {
    for (std::size_t bucket = 0; bucket < data.length; ++bucket) {
      float lo = INFINITY, hi = -INFINITY;
      double squares = 0;
      std::uint64_t count = 0;
      const std::uint64_t end = std::min<std::uint64_t>((bucket + 1) * framesPerBucket, frames);
      for (std::uint64_t frame = bucket * framesPerBucket; frame < end; ++frame) {
        for (std::uint32_t channel = 0; channel < channels; ++channel) {
          if (split && channel != out) continue;
          const float x = interleaved[frame * channels + channel];
          lo = std::min(lo, x);
          hi = std::max(hi, x);
          squares += static_cast<double>(x) * x;
          ++count;
        }
      }
      data.min.push_back(lo);
      data.max.push_back(hi);
      data.rms.push_back(static_cast<float>(std::sqrt(squares / static_cast<double>(count))));
    }
  }
  return data;
}

void expectSame(const PeaksData& actual, const PeaksData& expected) {
  EXPECT_EQ(actual.channels, expected.channels);
  EXPECT_EQ(actual.length, expected.length);
  EXPECT_EQ(actual.frameCount, expected.frameCount);
  EXPECT_EQ(actual.min.size(), expected.min.size());
  for (std::size_t i = 0; i < expected.min.size(); ++i) {
    EXPECT_EQ(actual.min[i], expected.min[i]);
    EXPECT_EQ(actual.max[i], expected.max[i]);
    EXPECT_NEAR(actual.rms[i], expected.rms[i], 1e-6);
  }
}

} // namespace

TEST(matches_naive_reference_for_any_bucket_and_chunk_size) {
  const std::uint32_t channels = 2;
  const auto signal = randomSignal(1009 * channels, 42); // prime frame count → partial last bucket
  for (std::uint64_t framesPerBucket : {1u, 7u, 64u, 256u, 2000u}) {
    for (std::uint64_t chunk : {1u, 13u, 4096u}) {
      for (bool split : {false, true}) {
        expectSame(accumulate(signal, channels, framesPerBucket, split, chunk),
                   naive(signal, channels, framesPerBucket, split));
      }
    }
  }
}

TEST(computes_exact_statistics_for_a_known_bucket) {
  const auto data = accumulate({0.5f, -1.0f, 0.25f, 0.0f}, 1, 4, false, 4);
  EXPECT_EQ(data.length, 1u);
  EXPECT_EQ(data.min[0], -1.0f);
  EXPECT_EQ(data.max[0], 0.5f);
  EXPECT_NEAR(data.rms[0], std::sqrt((0.25 + 1.0 + 0.0625) / 4.0), 1e-7);
}

TEST(last_bucket_may_be_partial) {
  const auto data = accumulate({0.1f, 0.1f, 0.1f, 0.9f}, 1, 3, false, 1);
  EXPECT_EQ(data.length, 2u);
  EXPECT_EQ(data.frameCount, 4u);
  EXPECT_NEAR(data.rms[1], 0.9, 1e-7); // averaged over its single frame, not over 3
}

TEST(mixing_does_not_cancel_out_of_phase_channels) {
  // Left = +0.5, right = -0.5: summing would give silence.
  std::vector<float> signal;
  for (int i = 0; i < 8; ++i) {
    signal.push_back(0.5f);
    signal.push_back(-0.5f);
  }
  const auto data = accumulate(signal, 2, 8, false, 8);
  EXPECT_EQ(data.channels, 1u);
  EXPECT_EQ(data.min[0], -0.5f);
  EXPECT_EQ(data.max[0], 0.5f);
  EXPECT_NEAR(data.rms[0], 0.5, 1e-7);
}

TEST(split_channels_are_laid_out_channel_major) {
  // 4 frames, 2 buckets of 2 frames; left = 0.1, right = 0.7.
  std::vector<float> signal;
  for (int i = 0; i < 4; ++i) {
    signal.push_back(0.1f);
    signal.push_back(0.7f);
  }
  const auto data = accumulate(signal, 2, 2, true, 4);
  EXPECT_EQ(data.channels, 2u);
  EXPECT_EQ(data.length, 2u);
  EXPECT_EQ(data.max.size(), 4u);
  EXPECT_EQ(data.max[0], 0.1f); // channel 0, bucket 0
  EXPECT_EQ(data.max[1], 0.1f); // channel 0, bucket 1
  EXPECT_EQ(data.max[2], 0.7f); // channel 1, bucket 0
  EXPECT_EQ(data.max[3], 0.7f); // channel 1, bucket 1
}

TEST(no_frames_yields_empty_result) {
  PeaksAccumulator accumulator(2, 256, false);
  const auto data = accumulator.finish();
  EXPECT_EQ(data.length, 0u);
  EXPECT_EQ(data.frameCount, 0u);
  EXPECT_TRUE(data.min.empty());
}

TEST(rejects_invalid_configuration) {
  EXPECT_THROWS(PeaksAccumulator(0, 256, false), std::invalid_argument, "channels");
  EXPECT_THROWS(PeaksAccumulator(1, 0, false), std::invalid_argument, "framesPerBucket");
}
