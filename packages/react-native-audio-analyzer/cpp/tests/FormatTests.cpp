// Decoding real compressed files with the built-in decoders (all platforms).
// tone.mp3: CBR 64 kbit/s with a LAME/Info header; tone-noxing.mp3: the same
// without it; tone.flac: stereo, lossless; tone.ogg: stereo Vorbis.
#include "Analysis.hpp"
#include "AudioDecoder.hpp"
#include "TestHarness.hpp"
#include "Tone.hpp"

#include <string>

using namespace audioanalyzer;
using testing::expectSteadyTone;
using testing::fixture;
using testing::kToneRms;

namespace {

// The 64 kbit/s MP3 encoder lowers the level slightly: ffmpeg decodes the
// fixtures to an RMS of 0.336 (peak 0.475).
const double kMp3ToneRms = 0.336;

} // namespace

TEST(decodes_mp3_with_info_header) {
  const AudioInfo info = readInfo(fixture("tone.mp3"));
  EXPECT_EQ(info.format, std::string("mp3"));
  EXPECT_EQ(info.decoder, std::string("builtin"));
  EXPECT_EQ(info.sampleRate, 44100u);
  EXPECT_EQ(info.channels, 1u);
  // 0.5 s; MP3 frames hold 1152 samples, so allow one frame of padding either way.
  EXPECT_NEAR(static_cast<double>(info.frames), 22050.0, 1152.0);
  expectSteadyTone(analyze(fixture("tone.mp3"), {}), kMp3ToneRms, 0.015);
}

TEST(decodes_mp3_without_info_header) {
  const AudioInfo info = readInfo(fixture("tone-noxing.mp3"));
  EXPECT_EQ(info.format, std::string("mp3"));
  EXPECT_NEAR(static_cast<double>(info.frames), 22050.0, 2304.0);
  expectSteadyTone(analyze(fixture("tone-noxing.mp3"), {}), kMp3ToneRms, 0.015);
}

TEST(seeks_into_mp3) {
  AnalyzeOptions options;
  options.startTime = 0.25;
  const AnalysisResult result = analyze(fixture("tone.mp3"), options);
  EXPECT_EQ(result.startFrame, 11025u);
  EXPECT_NEAR(static_cast<double>(result.peaks.frameCount), 11025.0, 1152.0);
  EXPECT_NEAR(result.peaks.rms[result.peaks.length / 2], kMp3ToneRms, 0.015);
}

TEST(decodes_stereo_flac_losslessly) {
  const AudioInfo info = readInfo(fixture("tone.flac"));
  EXPECT_EQ(info.format, std::string("flac"));
  EXPECT_EQ(info.channels, 2u);
  EXPECT_EQ(info.frames, 22050u);
  AnalyzeOptions options;
  options.splitChannels = true;
  const AnalysisResult result = analyze(fixture("tone.flac"), options);
  EXPECT_EQ(result.peaks.channels, 2u);
  expectSteadyTone(result, kToneRms, 0.005);
}

TEST(decodes_ogg_vorbis) {
  const AudioInfo info = readInfo(fixture("tone.ogg"));
  EXPECT_EQ(info.format, std::string("vorbis"));
  EXPECT_EQ(info.decoder, std::string("builtin"));
  EXPECT_EQ(info.channels, 2u);
  // miniaudio cannot report the length of Vorbis; it comes from the last Ogg
  // page's granule position, without decoding.
  EXPECT_NEAR(static_cast<double>(info.frames), 22050.0, 1024.0);
  EXPECT_TRUE(AudioDecoder::openFile(fixture("tone.ogg"))->lengthInFrames().has_value());
  EXPECT_TRUE(AudioDecoder::openMemory(testing::fixtureBytes("tone.ogg"))->lengthInFrames().has_value());

  // Trailing bytes that look like an Ogg page with a huge granule but have no
  // valid checksum (e.g. "OggS" inside other data) don't change the length.
  auto bytes = std::make_shared<std::vector<std::uint8_t>>(*testing::fixtureBytes("tone.ogg"));
  const auto expected = AudioDecoder::openMemory(bytes)->lengthInFrames();
  const std::uint8_t fake[] = {'O', 'g', 'g', 'S', 0, 4, 0xFF, 0xFF, 0xFF, 0x0F, 0, 0, 0, 0, 1, 2, 3, 4,
                               9, 0, 0, 0, 0xAA, 0xBB, 0xCC, 0xDD, 0};
  bytes->insert(bytes->end(), std::begin(fake), std::end(fake));
  EXPECT_TRUE(expected.has_value());
  EXPECT_EQ(AudioDecoder::openMemory(bytes)->lengthInFrames().value_or(0), *expected);
  AnalyzeOptions options;
  options.splitChannels = true;
  expectSteadyTone(analyze(fixture("tone.ogg"), options), kToneRms, 0.02);
}

TEST(decodes_ogg_vorbis_from_memory) {
  expectSteadyTone(analyze(testing::fixtureBytes("tone.ogg"), {}), kToneRms, 0.02);
}
