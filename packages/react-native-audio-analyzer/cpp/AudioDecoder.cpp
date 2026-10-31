#include "AudioDecoder.hpp"

#include "Decoders.hpp"

#include <array>
#include <cerrno>
#include <cstdio>
#include <cstring>
#include <optional>
#include <stdexcept>

namespace audioanalyzer {

namespace {

enum class Container { Unknown, Ogg, Mp4, Caf, Aiff, Matroska, Amr };

// QuickTime/MP4 top-level atoms that can come before (or instead of) `ftyp`.
bool isQuickTimeAtom(const std::uint8_t* type) {
  for (const char* atom : {"ftyp", "moov", "mdat", "wide", "free", "skip", "pnot"}) {
    if (std::memcmp(type, atom, 4) == 0) return true;
  }
  return false;
}

// Recognizes containers by their signature. Everything except Ogg goes
// straight to the platform decoder, and Ogg only to the Vorbis decoder:
// miniaudio's MP3 decoder scans for frame sync words and could mistake their
// payload for MP3 frames.
Container sniff(const std::uint8_t* bytes, std::size_t size) {
  if (size >= 4 && std::memcmp(bytes, "OggS", 4) == 0) return Container::Ogg;
  if (size >= 8 && isQuickTimeAtom(bytes + 4)) return Container::Mp4;
  // EBML header: WebM and Matroska (e.g. Opus voice messages from browsers).
  if (size >= 4 && bytes[0] == 0x1A && bytes[1] == 0x45 && bytes[2] == 0xDF && bytes[3] == 0xA3) {
    return Container::Matroska;
  }
  if (size >= 5 && std::memcmp(bytes, "#!AMR", 5) == 0) return Container::Amr; // also "#!AMR-WB"

  if (size >= 4 && std::memcmp(bytes, "caff", 4) == 0) return Container::Caf;
  if (size >= 12 && std::memcmp(bytes, "FORM", 4) == 0 &&
      (std::memcmp(bytes + 8, "AIFF", 4) == 0 || std::memcmp(bytes + 8, "AIFC", 4) == 0)) {
    return Container::Aiff;
  }
  return Container::Unknown;
}

std::optional<detail::BuiltinFormats> builtinFormatsFor(Container container) {
  switch (container) {
    case Container::Unknown:
      return detail::BuiltinFormats::All;
    case Container::Ogg:
      return detail::BuiltinFormats::OggOnly;
    default:
      return std::nullopt; // platform decoder only
  }
}

[[noreturn]] void unsupported(const std::string& subject) {
  throw std::runtime_error("Unsupported or corrupted audio " + subject + " (" + detail::supportedFormats() + ")");
}

} // namespace

std::unique_ptr<AudioDecoder> AudioDecoder::openFile(const std::string& path) {
  const std::string description = "\"" + path + "\"";

  std::array<std::uint8_t, 12> header{};
  std::size_t headerSize = 0;
  if (std::FILE* file = std::fopen(path.c_str(), "rb")) {
    headerSize = std::fread(header.data(), 1, header.size(), file);
    std::fclose(file);
  } else {
    const int error = errno;
    if (error == ENOENT) {
      throw std::runtime_error("File does not exist: " + description);
    }
    throw std::runtime_error("Cannot open " + description + ": " + std::strerror(error));
  }

  if (const auto formats = builtinFormatsFor(sniff(header.data(), headerSize))) {
    if (auto decoder = detail::openBuiltinFile(path, *formats)) return decoder;
  }
  if (auto decoder = detail::openPlatformFile(path)) return decoder;
  unsupported("file " + description);
}

std::unique_ptr<AudioDecoder> AudioDecoder::openMemory(std::shared_ptr<const std::vector<std::uint8_t>> data) {
  if (!data || data->empty()) {
    throw std::invalid_argument("Audio data is empty");
  }
  if (const auto formats = builtinFormatsFor(sniff(data->data(), data->size()))) {
    if (auto decoder = detail::openBuiltinMemory(data, *formats)) return decoder;
  }
  if (auto decoder = detail::openPlatformMemory(data)) return decoder;
  unsupported("data (in-memory, " + std::to_string(data->size()) + " bytes)");
}

} // namespace audioanalyzer
