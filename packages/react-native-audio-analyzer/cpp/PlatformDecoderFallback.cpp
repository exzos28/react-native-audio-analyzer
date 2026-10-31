// Platforms without a platform decoder (host tests on Linux): only the
// built-in decoders are available.

#if !defined(__APPLE__) && !defined(__ANDROID__)

#include "Decoders.hpp"

namespace audioanalyzer::detail {

std::unique_ptr<AudioDecoder> openPlatformFile(const std::string&) {
  return nullptr;
}

std::unique_ptr<AudioDecoder> openPlatformMemory(const Bytes&) {
  return nullptr;
}

const char* supportedFormats() noexcept {
  return "supported formats: WAV, FLAC, MP3, OGG Vorbis";
}

} // namespace audioanalyzer::detail

#endif
