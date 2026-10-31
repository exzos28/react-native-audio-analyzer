#pragma once

// Internal: the decoder implementations behind AudioDecoder::openFile/openMemory.

#include "AudioDecoder.hpp"

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

namespace audioanalyzer::detail {

using Bytes = std::shared_ptr<const std::vector<std::uint8_t>>;

/** Which built-in decoders may be tried for a source. */
enum class BuiltinFormats {
  All,
  /** Ogg container: only Vorbis. Keeps Ogg/Opus away from the MP3 decoder. */
  OggOnly,
};

/** Built-in decoders (miniaudio). Return nullptr when the format is not one of theirs. */
std::unique_ptr<AudioDecoder> openBuiltinFile(const std::string& path, BuiltinFormats formats);
std::unique_ptr<AudioDecoder> openBuiltinMemory(const Bytes& data, BuiltinFormats formats);

/**
 * The operating system's decoders. Return nullptr when the platform has no
 * decoder for the source (or no platform decoder exists, e.g. in host tests
 * on Linux).
 */
std::unique_ptr<AudioDecoder> openPlatformFile(const std::string& path);
std::unique_ptr<AudioDecoder> openPlatformMemory(const Bytes& data);

/** Human-readable list of the formats this build can decode, for error messages. */
const char* supportedFormats() noexcept;

} // namespace audioanalyzer::detail
