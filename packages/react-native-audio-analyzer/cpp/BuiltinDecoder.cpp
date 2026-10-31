// Built-in decoders: miniaudio's WAV, FLAC, MP3 and (via stb_vorbis) Vorbis.
// They behave identically on every platform and are tested on the host.

#include "Decoders.hpp"

#include "MiniaudioConfig.h"

#include <array>
#include <cstdio>
#include <cstring>
#include <limits>
#include <stdexcept>
#include <utility>
#include <vector>

namespace audioanalyzer::detail {

namespace {

struct Backend {
  ma_encoding_format format;
  const char* name;
};

// Tried in this order. WAV, FLAC and Vorbis (Ogg) have unambiguous headers;
// MP3 goes last because its decoder scans for frame sync words and is the
// most permissive.
constexpr std::array<Backend, 4> kBackends{{
    {ma_encoding_format_wav, "wav"},
    {ma_encoding_format_flac, "flac"},
    {ma_encoding_format_vorbis, "vorbis"},
    {ma_encoding_format_mp3, "mp3"},
}};

// Ogg page CRC: polynomial 0x04c11db7, MSB first, initial value 0, computed
// with the checksum field zeroed (RFC 3533).
std::uint32_t oggCrc(const std::uint8_t* page, std::size_t size) {
  static const auto table = [] {
    std::array<std::uint32_t, 256> values{};
    for (std::uint32_t i = 0; i < 256; ++i) {
      std::uint32_t r = i << 24;
      for (int bit = 0; bit < 8; ++bit) r = (r & 0x80000000u) ? (r << 1) ^ 0x04c11db7u : r << 1;
      values[i] = r;
    }
    return values;
  }();
  std::uint32_t crc = 0;
  for (std::size_t i = 0; i < size; ++i) {
    const std::uint8_t byte = (i >= 22 && i < 26) ? 0 : page[i];
    crc = (crc << 8) ^ table[((crc >> 24) ^ byte) & 0xFF];
  }
  return crc;
}

std::uint32_t readLE32(const std::uint8_t* bytes) {
  return static_cast<std::uint32_t>(bytes[0]) | static_cast<std::uint32_t>(bytes[1]) << 8 |
         static_cast<std::uint32_t>(bytes[2]) << 16 | static_cast<std::uint32_t>(bytes[3]) << 24;
}

constexpr std::size_t kOggHeaderSize = 27;

// Length of an Ogg Vorbis stream in frames: the granule position of the last
// complete page of the stream with serial `serial` in `tail` (the end of the
// file). Only pages with a valid checksum count, so "OggS" inside packet data
// or pages of another logical stream are skipped. miniaudio decodes Vorbis in
// push mode and cannot report the length, which would otherwise cost a second
// decoding pass.
//
// Limitation: a stream that does not start at granule 0 (cut from a live
// stream) reports its end granule, which overstates the length. Analysis
// still reads until the end of the stream, so only progress and the
// automatic bucket size are affected.
std::optional<std::uint64_t> lastOggGranule(const std::uint8_t* tail, std::size_t size, std::uint32_t serial) {
  for (std::size_t i = size >= kOggHeaderSize ? size - kOggHeaderSize + 1 : 0; i-- > 0;) {
    const std::uint8_t* page = tail + i;
    if (std::memcmp(page, "OggS", 4) != 0 || page[4] != 0) continue; // magic, version 0
    const std::size_t segments = page[26];
    if (i + kOggHeaderSize + segments > size) continue;
    std::size_t bodySize = 0;
    for (std::size_t s = 0; s < segments; ++s) bodySize += page[kOggHeaderSize + s];
    const std::size_t pageSize = kOggHeaderSize + segments + bodySize;
    if (i + pageSize > size || oggCrc(page, pageSize) != readLE32(page + 22)) continue;
    if (readLE32(page + 14) != serial) continue;
    std::uint64_t granule = 0;
    for (int byte = 7; byte >= 0; --byte) granule = (granule << 8) | page[6 + byte];
    // -1 marks a page on which no packet ends; keep looking further back.
    if (granule != std::numeric_limits<std::uint64_t>::max() && granule > 0) return granule;
  }
  return std::nullopt;
}

// Serial number of the first Ogg page (the stream miniaudio decodes).
std::optional<std::uint32_t> firstOggSerial(const std::uint8_t* head, std::size_t size) {
  if (size < kOggHeaderSize || std::memcmp(head, "OggS", 4) != 0) return std::nullopt;
  return readLE32(head + 14);
}

constexpr std::size_t kOggTailSize = 64 * 1024;

class BuiltinDecoder final : public AudioDecoder {
public:
  BuiltinDecoder(std::string description, std::string path, Bytes data)
      : _description(std::move(description)), _path(std::move(path)), _data(std::move(data)) {}

  ~BuiltinDecoder() override {
    if (_initialized) {
      ma_decoder_uninit(&_decoder);
    }
  }

  // Tries the allowed backends; returns false if none accepts the source.
  template <typename Init>
  bool open(BuiltinFormats formats, Init&& init) {
    for (const Backend& backend : kBackends) {
      if (formats == BuiltinFormats::OggOnly && backend.format != ma_encoding_format_vorbis) continue;
      // ma_format_f32 with 0 channels / 0 sample rate: convert samples to
      // float but keep the native channel layout and sample rate.
      ma_decoder_config config = ma_decoder_config_init(ma_format_f32, 0, 0);
      config.encodingFormat = backend.format;
      if (init(config, &_decoder) == MA_SUCCESS) {
        _initialized = true;
        _format = backend.name;
        return true;
      }
    }
    return false;
  }

  const std::string& format() const noexcept override {
    return _format;
  }

  const char* decoder() const noexcept override {
    return "builtin";
  }

  std::uint32_t channels() const noexcept override {
    return _decoder.outputChannels;
  }

  std::uint32_t sampleRate() const noexcept override {
    return _decoder.outputSampleRate;
  }

  std::optional<std::uint64_t> lengthInFrames() override {
    ma_uint64 length = 0;
    if (ma_decoder_get_length_in_pcm_frames(&_decoder, &length) == MA_SUCCESS && length > 0) {
      return static_cast<std::uint64_t>(length);
    }
    return _format == "vorbis" ? oggLength() : std::nullopt;
  }

  std::uint64_t read(float* out, std::uint64_t frameCount) override {
    ma_uint64 framesRead = 0;
    const ma_result result = ma_decoder_read_pcm_frames(&_decoder, out, frameCount, &framesRead);
    if (result != MA_SUCCESS && result != MA_AT_END) {
      throw std::runtime_error("Failed to decode " + _description + ": " + ma_result_description(result));
    }
    return static_cast<std::uint64_t>(framesRead);
  }

  void seek(std::uint64_t frame, const std::atomic<bool>* /*cancelled*/) override {
    const ma_result result = ma_decoder_seek_to_pcm_frame(&_decoder, frame);
    if (result != MA_SUCCESS) {
      throw std::runtime_error("Failed to seek in " + _description + ": " + ma_result_description(result));
    }
  }

private:
  std::optional<std::uint64_t> oggLength() const {
    if (_data) {
      const auto serial = firstOggSerial(_data->data(), _data->size());
      if (!serial) return std::nullopt;
      const std::size_t size = std::min(_data->size(), kOggTailSize);
      return lastOggGranule(_data->data() + (_data->size() - size), size, *serial);
    }
    std::FILE* file = std::fopen(_path.c_str(), "rb");
    if (!file) return std::nullopt;
    std::array<std::uint8_t, kOggHeaderSize> head{};
    const auto serial = firstOggSerial(head.data(), std::fread(head.data(), 1, head.size(), file));
    std::vector<std::uint8_t> tail;
    if (serial && std::fseek(file, 0, SEEK_END) == 0) {
      const long end = std::ftell(file);
      const long start = end > static_cast<long>(kOggTailSize) ? end - static_cast<long>(kOggTailSize) : 0;
      if (end > 0 && std::fseek(file, start, SEEK_SET) == 0) {
        tail.resize(static_cast<std::size_t>(end - start));
        tail.resize(std::fread(tail.data(), 1, tail.size(), file));
      }
    }
    std::fclose(file);
    return serial ? lastOggGranule(tail.data(), tail.size(), *serial) : std::nullopt;
  }

  std::string _description;
  std::string _path; // empty for in-memory sources
  Bytes _data;       // keeps in-memory sources alive
  ma_decoder _decoder{};
  bool _initialized = false;
  std::string _format;
};

} // namespace

std::unique_ptr<AudioDecoder> openBuiltinFile(const std::string& path, BuiltinFormats formats) {
  auto decoder = std::make_unique<BuiltinDecoder>("\"" + path + "\"", path, nullptr);
  const bool opened = decoder->open(formats, [&](const ma_decoder_config& config, ma_decoder* out) {
    return ma_decoder_init_file(path.c_str(), &config, out);
  });
  return opened ? std::move(decoder) : nullptr;
}

std::unique_ptr<AudioDecoder> openBuiltinMemory(const Bytes& data, BuiltinFormats formats) {
  auto decoder = std::make_unique<BuiltinDecoder>("in-memory data", std::string(), data);
  const bool opened = decoder->open(formats, [&](const ma_decoder_config& config, ma_decoder* out) {
    return ma_decoder_init_memory(data->data(), data->size(), &config, out);
  });
  return opened ? std::move(decoder) : nullptr;
}

} // namespace audioanalyzer::detail
