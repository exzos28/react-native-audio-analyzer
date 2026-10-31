// Formats decoded by the platform decoder: AudioToolbox on Apple platforms
// (these tests run on macOS hosts and in the iOS simulator), MediaCodec on
// Android (run on a device or emulator, see run-android.sh). Elsewhere, only
// the built-in decoders exist and these formats must be rejected cleanly.
#include "Analysis.hpp"
#include "TestHarness.hpp"
#include "Tone.hpp"

#include <string>

using namespace audioanalyzer;
using testing::expectSteadyTone;
using testing::fixture;
using testing::fixtureBytes;
using testing::kToneRms;

#if defined(__APPLE__) || defined(__ANDROID__)

namespace {

void expectPlatformTone(const char* name, const char* format, std::uint32_t channels, double tolerance) {
  const AudioInfo info = readInfo(fixture(name));
  EXPECT_EQ(info.format, std::string(format));
  EXPECT_EQ(info.decoder, std::string("platform"));
  EXPECT_EQ(info.channels, channels);
  // AAC frames are 1024 samples; allow priming/padding either way.
  EXPECT_NEAR(static_cast<double>(info.frames), 22050.0, 2048.0);
  AnalyzeOptions options;
  options.splitChannels = true;
  expectSteadyTone(analyze(fixture(name), options), kToneRms, tolerance);
}

} // namespace

TEST(platform_decodes_aac_in_m4a) {
  expectPlatformTone("tone.m4a", "aac", 1, 0.02);
}

TEST(platform_decodes_raw_adts_aac) {
  expectPlatformTone("tone.aac", "aac", 1, 0.02);
}

TEST(platform_decodes_aac_from_memory) {
  const AnalysisResult result = analyze(fixtureBytes("tone.m4a"), {});
  expectSteadyTone(result, kToneRms, 0.02);
}

TEST(platform_seeks_in_aac) {
  AnalyzeOptions options;
  options.startTime = 0.25;
  const AnalysisResult result = analyze(fixture("tone.m4a"), options);
  EXPECT_EQ(result.startFrame, 11025u);
  EXPECT_NEAR(static_cast<double>(result.peaks.frameCount), 11025.0, 2048.0);
  EXPECT_NEAR(result.peaks.rms[result.peaks.length / 2], kToneRms, 0.02);
}

// onset.m4a: 0.1 s of silence, then the tone (AAC). The tone must appear at
// the same position (frame 4410) whether the file is analyzed from the start
// or from a seek target, on every platform. Guards against encoder-delay
// mistakes, which shift the waveform by ~1024 frames.
TEST(platform_places_aac_onset_correctly_after_seeking) {
  for (const double start : {0.0, 0.05, 0.09}) {
    AnalyzeOptions options;
    options.startTime = start;
    options.framesPerBucket = 64;
    const AnalysisResult result = analyze(fixture("onset.m4a"), options);
    std::size_t bucket = 0;
    while (bucket < result.peaks.length && result.peaks.rms[bucket] < 0.1f) ++bucket;
    const double onset = static_cast<double>(result.startFrame + bucket * 64);
    EXPECT_NEAR(onset, 4410.0, 128.0);
  }
}

// channels-change.aac: a mono ADTS stream followed by a stereo one. Callers
// size buffers from channels(), so a decoder must never start delivering more
// channels than it announced: decoding either stays consistent or fails with
// an error, but never overruns the buffer (ASan would catch that on hosts).
TEST(platform_handles_a_channel_layout_change_mid_stream) {
  try {
    AnalyzeOptions options;
    options.splitChannels = true;
    const AnalysisResult result = analyze(fixture("channels-change.aac"), options);
    EXPECT_TRUE(result.peaks.channels >= 1);
    for (float value : result.peaks.max) {
      EXPECT_TRUE(value <= 1.0f);
    }
  } catch (const std::runtime_error&) {
    // A descriptive error is fine (Android: "changes mid-stream", AudioToolbox:
    // a decode error); crashing or overrunning the buffer is not.
  }
}

#endif

#if defined(__APPLE__)

TEST(apple_decodes_alac) {
  expectPlatformTone("tone-alac.m4a", "alac", 1, 0.005);
}

TEST(apple_decodes_aiff) {
  expectPlatformTone("tone.aiff", "aiff", 1, 0.005);
}

#endif

#if defined(__ANDROID__)

TEST(android_decodes_ogg_opus) {
  // Opus always decodes at 48 kHz.
  const AudioInfo info = readInfo(fixture("tone.opus"));
  EXPECT_EQ(info.format, std::string("opus"));
  EXPECT_EQ(info.decoder, std::string("platform"));
  EXPECT_EQ(info.sampleRate, 48000u);
  AnalyzeOptions options;
  options.splitChannels = true;
  expectSteadyTone(analyze(fixture("tone.opus"), options), kToneRms, 0.03);
}

#endif

#if !defined(__APPLE__) && !defined(__ANDROID__)

TEST(without_platform_decoder_m4a_is_rejected) {
  EXPECT_THROWS(readInfo(fixture("tone.m4a")), std::runtime_error, "supported formats: WAV, FLAC, MP3, OGG Vorbis");
}

#endif

TEST(ogg_opus_never_reaches_the_mp3_decoder) {
  // Ogg is offered only to the Vorbis decoder; Opus must not be mistaken for
  // MP3. Depending on the platform it is decoded or rejected, never garbled.
  try {
    const AudioInfo info = readInfo(fixture("tone.opus"));
    EXPECT_EQ(info.format, std::string("opus"));
  } catch (const std::runtime_error& error) {
    EXPECT_TRUE(std::string(error.what()).find("Unsupported") != std::string::npos);
  }
}

// WebM/Matroska and QuickTime files without a leading `ftyp` go only to the
// platform decoder, like Ogg goes only to Vorbis: decoded by the platform or
// rejected, never handed to the permissive MP3 decoder.
TEST(webm_and_legacy_quicktime_never_reach_the_builtin_decoders) {
  for (const char* name : {"tone.webm", "tone-noftyp.mov"}) {
    try {
      const AudioInfo info = readInfo(fixture(name));
      EXPECT_EQ(std::string(info.decoder), std::string("platform"));
    } catch (const std::runtime_error& error) {
      EXPECT_TRUE(std::string(error.what()).find("Unsupported") != std::string::npos);
    }
  }
}
