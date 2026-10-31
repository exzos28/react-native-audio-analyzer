#include "Analysis.hpp"
#include "AudioDecoder.hpp"
#include "TestHarness.hpp"
#include "Wav.hpp"

#include <algorithm>
#include <atomic>
#include <cstdint>
#include <optional>
#include <string>
#include <memory>
#include <vector>

using namespace audioanalyzer;
using testing::kPcm16Tolerance;
using testing::makeWav;
using testing::TempFile;

namespace {

constexpr std::uint32_t kRate = 8000;

// One second of silence followed by one second at a constant level of 0.5.
std::vector<std::uint8_t> silenceThenTone() {
  return makeWav(2 * kRate, 1, kRate, [](std::uint32_t frame, std::uint16_t) { return frame < kRate ? 0.0f : 0.5f; });
}

AudioSource memory(std::vector<std::uint8_t> bytes) {
  return std::make_shared<const std::vector<std::uint8_t>>(std::move(bytes));
}

} // namespace

TEST(reads_info_without_decoding_the_samples) {
  const TempFile file("info.wav", makeWav(12345, 2, 44100, [](auto, auto) { return 0.0f; }));
  const AudioInfo info = readInfo(file.path());
  EXPECT_EQ(info.format, std::string("wav"));
  EXPECT_EQ(info.sampleRate, 44100u);
  EXPECT_EQ(info.channels, 2u);
  EXPECT_EQ(info.frames, 12345u);
}

TEST(analyzes_the_whole_file_with_default_bucket_size) {
  const TempFile file("whole.wav", silenceThenTone());
  const AnalysisResult result = analyze(file.path(), {});
  EXPECT_EQ(result.sampleRate, kRate);
  EXPECT_EQ(result.startFrame, 0u);
  EXPECT_EQ(result.peaks.framesPerBucket, 256u);
  EXPECT_EQ(result.peaks.frameCount, 2u * kRate);
  EXPECT_EQ(result.peaks.length, (2u * kRate + 255) / 256);
  EXPECT_NEAR(result.peaks.max.front(), 0.0, kPcm16Tolerance);
  EXPECT_NEAR(result.peaks.max.back(), 0.5, kPcm16Tolerance);
  EXPECT_NEAR(result.peaks.rms.back(), 0.5, kPcm16Tolerance);
}

TEST(auto_bucket_size_caps_the_number_of_buckets) {
  EXPECT_EQ(autoFramesPerBucket(0, 100000), 256u);
  EXPECT_EQ(autoFramesPerBucket(1000, 100000), 256u);
  EXPECT_EQ(autoFramesPerBucket(25600000, 100000), 256u);
  // One hour at 48 kHz: 172.8M frames → 1728 frames per bucket → 100 000 buckets.
  EXPECT_EQ(autoFramesPerBucket(172800000, 100000), 1728u);
  // A tight budget for list thumbnails.
  EXPECT_EQ(autoFramesPerBucket(441000, 100), 4410u);
  EXPECT_THROWS(autoFramesPerBucket(1000, 0), std::invalid_argument, "maxBuckets");
}

TEST(max_buckets_limits_the_result) {
  const TempFile file("maxbuckets.wav", silenceThenTone());
  AnalyzeOptions options;
  options.maxBuckets = 10;
  const AnalysisResult result = analyze(file.path(), options);
  EXPECT_EQ(result.peaks.framesPerBucket, 1600u);
  EXPECT_EQ(result.peaks.length, 10u);
}

TEST(honors_an_explicit_bucket_size) {
  const TempFile file("explicit.wav", silenceThenTone());
  AnalyzeOptions options;
  options.framesPerBucket = 1000;
  const AnalysisResult result = analyze(file.path(), options);
  EXPECT_EQ(result.peaks.framesPerBucket, 1000u);
  EXPECT_EQ(result.peaks.length, 16u);
}

TEST(analyzes_only_the_requested_range) {
  const TempFile file("range.wav", silenceThenTone());
  AnalyzeOptions options;
  options.startTime = 1.5;
  options.endTime = 1.75;
  options.framesPerBucket = 100;
  const AnalysisResult result = analyze(file.path(), options);
  EXPECT_EQ(result.startFrame, 12000u);
  EXPECT_EQ(result.peaks.frameCount, 2000u);
  EXPECT_EQ(result.peaks.length, 20u);
  for (float value : result.peaks.rms) {
    EXPECT_NEAR(value, 0.5, kPcm16Tolerance);
  }
}

TEST(range_beyond_the_end_is_clamped) {
  const TempFile file("clamp.wav", silenceThenTone());
  AnalyzeOptions options;
  options.startTime = 1.0;
  options.endTime = 60.0;
  EXPECT_EQ(analyze(file.path(), options).peaks.frameCount, kRate);

  options.startTime = 30.0;
  options.endTime = std::nullopt;
  std::vector<double> reports;
  const AnalysisResult empty = analyze(file.path(), options, nullptr, [&](double f) { reports.push_back(f); });
  EXPECT_EQ(empty.peaks.length, 0u);
  EXPECT_EQ(empty.peaks.framesPerBucket, 256u);
  EXPECT_EQ(empty.startFrame, 2u * kRate);
  EXPECT_EQ(reports.size(), 1u); // just "done"
  EXPECT_EQ(reports.back(), 1.0);
}

TEST(rejects_invalid_ranges) {
  const TempFile file("badrange.wav", silenceThenTone());
  AnalyzeOptions options;
  options.startTime = -1;
  EXPECT_THROWS(analyze(file.path(), options), std::invalid_argument, "start");
  options.startTime = 1;
  options.endTime = 0.5;
  EXPECT_THROWS(analyze(file.path(), options), std::invalid_argument, "end");
}

TEST(splits_channels_on_request) {
  const TempFile file("split.wav", makeWav(1000, 2, kRate, [](auto, std::uint16_t channel) {
                        return channel == 0 ? 0.2f : -0.6f;
                      }));
  AnalyzeOptions options;
  options.splitChannels = true;
  options.framesPerBucket = 1000;
  const AnalysisResult result = analyze(file.path(), options);
  EXPECT_EQ(result.peaks.channels, 2u);
  EXPECT_NEAR(result.peaks.max[0], 0.2, kPcm16Tolerance);
  EXPECT_NEAR(result.peaks.min[1], -0.6, kPcm16Tolerance);
}

TEST(decodes_in_memory_data_like_a_file) {
  const auto bytes = silenceThenTone();
  const TempFile file("memory.wav", bytes);
  const AnalysisResult fromFile = analyze(file.path(), {});
  const AnalysisResult fromMemory = analyze(memory(bytes), {});
  EXPECT_EQ(fromMemory.peaks.length, fromFile.peaks.length);
  for (std::size_t i = 0; i < fromFile.peaks.length; ++i) {
    EXPECT_EQ(fromMemory.peaks.rms[i], fromFile.peaks.rms[i]);
  }
  EXPECT_EQ(readInfo(memory(bytes)).format, std::string("wav"));
}

TEST(reports_monotonic_progress_ending_at_one) {
  const TempFile file("progress.wav", makeWav(100000, 1, kRate, [](auto, auto) { return 0.1f; }));
  std::vector<double> reports;
  analyze(file.path(), {}, nullptr, [&](double fraction) { reports.push_back(fraction); });
  EXPECT_TRUE(reports.size() >= 2);
  EXPECT_TRUE(reports.size() <= 101);
  for (std::size_t i = 1; i < reports.size(); ++i) {
    EXPECT_TRUE(reports[i] > reports[i - 1]);
  }
  EXPECT_EQ(reports.back(), 1.0);
}

TEST(stops_when_cancelled) {
  const TempFile file("cancel.wav", makeWav(100000, 1, kRate, [](auto, auto) { return 0.1f; }));
  std::atomic<bool> cancelled{true};
  EXPECT_THROWS(analyze(file.path(), {}, &cancelled), AnalysisCancelled, "cancelled");

  // Cancel halfway through, from the progress callback.
  std::atomic<bool> midway{false};
  double last = 0;
  EXPECT_THROWS(analyze(file.path(), {}, &midway,
                        [&](double fraction) {
                          last = fraction;
                          if (fraction >= 0.5) midway = true;
                        }),
                AnalysisCancelled, "cancelled");
  EXPECT_TRUE(last < 1.0);
}

TEST(missing_file_throws_descriptive_error) {
  EXPECT_THROWS(analyze(std::string("/definitely/not/here.mp3"), {}), std::runtime_error,
                "File does not exist: \"/definitely/not/here.mp3\"");
}

TEST(unsupported_data_throws_descriptive_error) {
  const std::string text = "this is not an audio file, just some text pretending to be one";
  const TempFile file("garbage.m4a", std::vector<std::uint8_t>(text.begin(), text.end()));
  EXPECT_THROWS(analyze(file.path(), {}), std::runtime_error, "(supported formats: WAV, FLAC, MP3, OGG Vorbis");
  EXPECT_THROWS(analyze(memory(std::vector<std::uint8_t>(text.begin(), text.end())), {}), std::runtime_error,
                "Unsupported or corrupted audio data (in-memory");
  EXPECT_THROWS(analyze(memory({}), {}), std::invalid_argument, "empty");
}

TEST(fine_resolutions_within_the_bucket_limit_are_allowed) {
  // 1-frame buckets on a short file stay far below the 30M bucket limit.
  const TempFile file("limit.wav", silenceThenTone());
  AnalyzeOptions options;
  options.framesPerBucket = 1;
  EXPECT_EQ(analyze(file.path(), options).peaks.length, 2u * kRate);
}

namespace {

// A decoder whose reported length differs from what it actually delivers, as
// with container metadata that is off by a codec frame (Android) or more.
class MisreportingDecoder final : public AudioDecoder {
public:
  MisreportingDecoder(std::uint64_t actualFrames, std::optional<std::uint64_t> reportedFrames)
      : _actual(actualFrames), _reported(reportedFrames) {}

  const std::string& format() const noexcept override { return _format; }
  const char* decoder() const noexcept override { return "builtin"; }
  std::uint32_t channels() const noexcept override { return 1; }
  std::uint32_t sampleRate() const noexcept override { return 1000; }
  std::optional<std::uint64_t> lengthInFrames() override { return _reported; }

  std::uint64_t read(float* out, std::uint64_t frameCount) override {
    const std::uint64_t count = std::min(frameCount, _actual - _position);
    for (std::uint64_t i = 0; i < count; ++i) out[i] = 0.5f;
    _position += count;
    return count;
  }

  void seek(std::uint64_t frame, const std::atomic<bool>*) override { _position = std::min(frame, _actual); }

private:
  std::uint64_t _actual;
  std::optional<std::uint64_t> _reported;
  std::uint64_t _position = 0;
  std::string _format = "fake";
};

} // namespace

TEST(reads_past_a_short_length_estimate_to_the_end_of_the_stream) {
  MisreportingDecoder decoder(10'000, 8'976); // one AAC frame short
  AnalyzeOptions options;
  options.framesPerBucket = 256;
  std::vector<double> reports;
  const AnalysisResult result = analyzeDecoder(decoder, options, nullptr, [&](double f) { reports.push_back(f); });
  EXPECT_EQ(result.peaks.frameCount, 10'000u);
  EXPECT_EQ(result.peaks.length, 40u);
  EXPECT_EQ(reports.back(), 1.0);
  for (std::size_t i = 0; i + 1 < reports.size(); ++i) {
    EXPECT_TRUE(reports[i] < 1.0);
  }
}

TEST(stops_at_the_end_of_the_stream_when_the_estimate_is_long) {
  MisreportingDecoder decoder(5'000, 6'000);
  AnalyzeOptions options;
  options.framesPerBucket = 256;
  EXPECT_EQ(analyzeDecoder(decoder, options).peaks.frameCount, 5'000u);
}

TEST(an_explicit_end_past_a_short_estimate_is_honoured) {
  MisreportingDecoder decoder(10'000, 8'976);
  AnalyzeOptions options;
  options.framesPerBucket = 256;
  options.startTime = 1.0;
  options.endTime = 9.5; // frame 9500, past the estimate
  const AnalysisResult result = analyzeDecoder(decoder, options);
  EXPECT_EQ(result.startFrame, 1'000u);
  EXPECT_EQ(result.peaks.frameCount, 8'500u);
}
