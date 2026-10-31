#pragma once

#include <atomic>
#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <vector>

namespace audioanalyzer {

/**
 * A source of interleaved 32-bit float PCM in the file's native channel count
 * and sample rate.
 *
 * Two implementations exist: the built-in decoders (miniaudio: WAV, FLAC,
 * MP3, OGG Vorbis — identical on every platform) and the platform decoder
 * (AudioToolbox on Apple platforms, NDK MediaCodec on Android) for everything
 * else the operating system can decode, such as AAC/M4A.
 *
 * No third-party header leaks into this file, so it is safe to include from
 * public headers.
 */
class AudioDecoder {
public:
  /**
   * Opens the file at `path` with the first decoder that accepts it.
   * Throws std::runtime_error if the file is missing or no decoder can read it.
   */
  static std::unique_ptr<AudioDecoder> openFile(const std::string& path);

  /**
   * Decodes an encoded audio file held in memory. The decoder keeps `data`
   * alive. Throws std::runtime_error if no decoder can read it.
   */
  static std::unique_ptr<AudioDecoder> openMemory(std::shared_ptr<const std::vector<std::uint8_t>> data);

  virtual ~AudioDecoder() = default;
  AudioDecoder(const AudioDecoder&) = delete;
  AudioDecoder& operator=(const AudioDecoder&) = delete;

  /** Codec or container, e.g. `"mp3"`, `"aac"`, `"vorbis"`. */
  virtual const std::string& format() const noexcept = 0;
  /** `"builtin"` or `"platform"`. */
  virtual const char* decoder() const noexcept = 0;
  virtual std::uint32_t channels() const noexcept = 0;
  virtual std::uint32_t sampleRate() const noexcept = 0;

  /** Total length in frames, or std::nullopt if the source cannot report it. */
  virtual std::optional<std::uint64_t> lengthInFrames() = 0;

  /**
   * Reads up to `frameCount` frames into `out` (which must hold
   * `frameCount * channels()` floats). Returns the number of frames read;
   * 0 means the end of the stream. Throws std::runtime_error on decode errors.
   */
  virtual std::uint64_t read(float* out, std::uint64_t frameCount) = 0;

  /**
   * Seeks to `frame`. Throws std::runtime_error on failure.
   *
   * Decoders that reach the target by decoding (Android's platform decoder)
   * poll `cancelled` while doing so and return early when it is set; the
   * caller must check the flag afterwards.
   */
  virtual void seek(std::uint64_t frame, const std::atomic<bool>* cancelled) = 0;

protected:
  AudioDecoder() = default;
};

} // namespace audioanalyzer
