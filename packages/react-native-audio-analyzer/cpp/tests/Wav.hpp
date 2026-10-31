#pragma once

#include <cstdint>
#include <filesystem>
#include <fstream>
#include <functional>
#include <iterator>
#include <string>
#include <vector>

namespace testing {

/** Builds a 16-bit PCM WAV file; `sampleAt(frame, channel)` returns -1…1. */
inline std::vector<std::uint8_t> makeWav(std::uint32_t frames, std::uint16_t channels, std::uint32_t sampleRate,
                                         const std::function<float(std::uint32_t, std::uint16_t)>& sampleAt) {
  std::vector<std::uint8_t> out;
  auto u32 = [&](std::uint32_t value) {
    for (int i = 0; i < 4; ++i) out.push_back(static_cast<std::uint8_t>((value >> (8 * i)) & 0xFF));
  };
  auto u16 = [&](std::uint16_t value) {
    out.push_back(static_cast<std::uint8_t>(value & 0xFF));
    out.push_back(static_cast<std::uint8_t>((value >> 8) & 0xFF));
  };
  auto tag = [&](const char* text) { out.insert(out.end(), text, text + 4); };

  const std::uint16_t blockAlign = channels * 2;
  const std::uint32_t dataSize = frames * blockAlign;
  tag("RIFF");
  u32(36 + dataSize);
  tag("WAVE");
  tag("fmt ");
  u32(16);
  u16(1); // PCM
  u16(channels);
  u32(sampleRate);
  u32(sampleRate * blockAlign);
  u16(blockAlign);
  u16(16);
  tag("data");
  u32(dataSize);
  for (std::uint32_t frame = 0; frame < frames; ++frame) {
    for (std::uint16_t channel = 0; channel < channels; ++channel) {
      const auto pcm = static_cast<std::int16_t>(sampleAt(frame, channel) * 32767.0f);
      u16(static_cast<std::uint16_t>(pcm));
    }
  }
  return out;
}

/** Writes `bytes` to a uniquely named file in the temp directory and removes it on destruction. */
class TempFile {
public:
  TempFile(const std::string& name, const std::vector<std::uint8_t>& bytes)
      : _path(std::filesystem::temp_directory_path() / ("audioanalyzer-test-" + name)) {
    std::ofstream out(_path, std::ios::binary);
    out.write(reinterpret_cast<const char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
  }
  ~TempFile() {
    std::error_code ignored;
    std::filesystem::remove(_path, ignored);
  }
  std::string path() const {
    return _path.string();
  }

private:
  std::filesystem::path _path;
};

/** 16-bit PCM quantization error bound. */
constexpr double kPcm16Tolerance = 1e-3;

} // namespace testing
