#pragma once

// Fixtures in fixtures/ are 0.5 s of a 440 Hz sine at amplitude 0.5,
// generated with ffmpeg ("aevalsrc=0.5*sin(2*PI*440*t):s=44100:d=0.5") and
// encoded in different formats.

#include "Analysis.hpp"
#include "TestHarness.hpp"

#include <cmath>
#include <fstream>
#include <iterator>
#include <memory>
#include <string>
#include <vector>

namespace testing {

inline std::string fixture(const char* name) {
  return std::string(AUDIOANALYZER_FIXTURES) + "/" + name;
}

inline std::shared_ptr<const std::vector<std::uint8_t>> fixtureBytes(const char* name) {
  std::ifstream in(fixture(name), std::ios::binary);
  return std::make_shared<const std::vector<std::uint8_t>>(std::istreambuf_iterator<char>(in),
                                                           std::istreambuf_iterator<char>());
}

// RMS of a sine with amplitude 0.5. A 256-frame bucket is not a whole number
// of 440 Hz periods, so single buckets deviate by up to ~1%.
const double kToneRms = 0.5 / std::sqrt(2.0);

// Checks the buckets away from the edges of every channel, which hold encoder
// delay, padding and the partial last bucket.
inline void expectSteadyTone(const audioanalyzer::AnalysisResult& result, double expectedRms, double tolerance) {
  const audioanalyzer::PeaksData& peaks = result.peaks;
  EXPECT_TRUE(peaks.length > 30);
  for (std::uint32_t channel = 0; channel < peaks.channels; ++channel) {
    for (std::size_t bucket = 10; bucket + 10 < peaks.length; ++bucket) {
      const std::size_t i = channel * peaks.length + bucket;
      EXPECT_NEAR(peaks.rms[i], expectedRms, tolerance);
      EXPECT_TRUE(peaks.max[i] <= 0.56f);
      EXPECT_TRUE(peaks.max[i] >= 0.42f);
    }
  }
}

} // namespace testing
