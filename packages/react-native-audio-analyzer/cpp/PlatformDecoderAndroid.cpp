// Platform decoder for Android: NDK MediaExtractor + MediaCodec, which decode
// whatever the device supports (AAC/M4A, Opus, AMR, …). Plain C API, so it
// runs right here in the C++ core without JNI.

#if defined(__ANDROID__)

#include "Decoders.hpp"

#include <media/NdkMediaCodec.h>
#include <media/NdkMediaDataSource.h>
#include <media/NdkMediaExtractor.h>
#include <media/NdkMediaFormat.h>

#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

#include <algorithm>
#include <atomic>
#include <cstring>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace audioanalyzer::detail {

namespace {

// android.media.AudioFormat encodings (the "pcm-encoding" key).
constexpr int32_t kEncodingPcm16Bit = 2;
constexpr int32_t kEncodingPcmFloat = 4;
constexpr int64_t kDequeueTimeoutUs = 5'000;
// Give up when the codec makes no progress for this many dequeue attempts (~10 s).
constexpr int kMaxIdlePolls = 2'000;

std::string formatName(const std::string& mime) {
  if (mime == "audio/mp4a-latm") return "aac";
  if (mime == "audio/mpeg") return "mp3";
  if (mime == "audio/raw") return "pcm";
  if (mime == "audio/3gpp") return "amr";
  const auto slash = mime.find('/');
  return slash == std::string::npos ? mime : mime.substr(slash + 1);
}

class AndroidDecoder final : public AudioDecoder {
public:
  AndroidDecoder(std::string description, Bytes data) : _description(std::move(description)), _data(std::move(data)) {}

  ~AndroidDecoder() override {
    release();
    if (_dataSource) {
      if (__builtin_available(android 28, *)) AMediaDataSource_delete(_dataSource);
    }
    if (_fd >= 0) close(_fd);
  }

  bool openPath(const std::string& path) {
    _fd = ::open(path.c_str(), O_RDONLY | O_CLOEXEC);
    if (_fd < 0) return false;
    struct stat info {};
    if (fstat(_fd, &info) != 0) return false;
    _fileSize = info.st_size;
    return _formatLocked = attach() && configure();
  }

  bool openMemory() {
    // AMediaDataSource is available from Android 9 (API 28).
    if (__builtin_available(android 28, *)) {
      _dataSource = AMediaDataSource_new();
      AMediaDataSource_setUserdata(_dataSource, const_cast<std::vector<std::uint8_t>*>(_data.get()));
      AMediaDataSource_setReadAt(_dataSource, [](void* user, off64_t offset, void* buffer, size_t size) -> ssize_t {
        const auto* bytes = static_cast<const std::vector<std::uint8_t>*>(user);
        if (offset < 0) return -1;
        if (static_cast<std::size_t>(offset) >= bytes->size()) return 0; // end of stream
        const std::size_t count = std::min(size, bytes->size() - static_cast<std::size_t>(offset));
        std::memcpy(buffer, bytes->data() + offset, count);
        return static_cast<ssize_t>(count);
      });
      AMediaDataSource_setGetSize(_dataSource, [](void* user) -> ssize_t {
        return static_cast<ssize_t>(static_cast<const std::vector<std::uint8_t>*>(user)->size());
      });
      return _formatLocked = attach() && configure();
    }
    return false;
  }

  const std::string& format() const noexcept override {
    return _format;
  }

  const char* decoder() const noexcept override {
    return "platform";
  }

  std::uint32_t channels() const noexcept override {
    return _channels;
  }

  std::uint32_t sampleRate() const noexcept override {
    return _sampleRate;
  }

  // Derived from the container's duration: may differ from the decoded
  // length by a codec frame (encoder delay/padding).
  std::optional<std::uint64_t> lengthInFrames() override {
    if (_durationUs <= 0) return std::nullopt;
    return static_cast<std::uint64_t>((static_cast<double>(_durationUs) * _sampleRate) / 1e6 + 0.5);
  }

  std::uint64_t read(float* out, std::uint64_t frameCount) override {
    const std::size_t wanted = static_cast<std::size_t>(frameCount) * _channels;
    while (_pending.size() - _pendingOffset < wanted && !_outputDone) {
      pump();
    }
    const std::size_t available = std::min(wanted, _pending.size() - _pendingOffset);
    const std::size_t frames = available / _channels;
    std::memcpy(out, _pending.data() + _pendingOffset, frames * _channels * sizeof(float));
    _pendingOffset += frames * _channels;
    if (_pendingOffset == _pending.size()) {
      _pending.clear();
      _pendingOffset = 0;
    }
    return frames;
  }

  // Presentation times after a seek or flush don't line up reliably with the
  // decoded samples (decoders handle the encoder delay only at the start of a
  // fresh stream), so seeking restarts extractor and codec from scratch and
  // drops exactly `frame` decoded frames. This costs decoding up to the
  // target, like MP3 in the built-in decoder, but places the range precisely
  // (verified against AudioToolbox with an onset fixture).
  void seek(std::uint64_t frame, const std::atomic<bool>* cancelled) override {
    release();
    _pending.clear();
    _pendingOffset = 0;
    _inputDone = false;
    _outputDone = false;
    _outputFormatKnown = false;
    _idlePolls = 0;
    _encoding = kEncodingPcm16Bit;
    _skipFrames = frame;
    if (!attach() || !configure()) {
      throw std::runtime_error("Failed to seek in " + _description);
    }
    // Skip to the target here, where cancellation can be honoured, rather
    // than inside the next read().
    while (_skipFrames > 0 && !_outputDone) {
      if (cancelled && cancelled->load(std::memory_order_relaxed)) return;
      pump();
    }
  }

private:
  void release() {
    if (_codec) {
      AMediaCodec_stop(_codec);
      AMediaCodec_delete(_codec);
      _codec = nullptr;
    }
    if (_extractor) {
      AMediaExtractor_delete(_extractor);
      _extractor = nullptr;
    }
  }

  // Creates the extractor on the file descriptor or the in-memory source.
  bool attach() {
    _extractor = AMediaExtractor_new();
    if (_fd >= 0) {
      return AMediaExtractor_setDataSourceFd(_extractor, _fd, 0, _fileSize) == AMEDIA_OK;
    }
    if (__builtin_available(android 28, *)) {
      return _dataSource && AMediaExtractor_setDataSourceCustom(_extractor, _dataSource) == AMEDIA_OK;
    }
    return false;
  }

  bool configure() {
    const size_t tracks = AMediaExtractor_getTrackCount(_extractor);
    for (size_t track = 0; track < tracks; ++track) {
      AMediaFormat* format = AMediaExtractor_getTrackFormat(_extractor, track);
      const char* mime = nullptr;
      if (AMediaFormat_getString(format, AMEDIAFORMAT_KEY_MIME, &mime) && mime &&
          std::strncmp(mime, "audio/", 6) == 0) {
        const bool ok = startCodec(track, format, mime);
        AMediaFormat_delete(format);
        return ok;
      }
      AMediaFormat_delete(format);
    }
    return false; // no audio track
  }

  bool startCodec(size_t track, AMediaFormat* format, const char* mime) {
    int32_t channels = 0;
    int32_t sampleRate = 0;
    if (!AMediaFormat_getInt32(format, AMEDIAFORMAT_KEY_CHANNEL_COUNT, &channels) ||
        !AMediaFormat_getInt32(format, AMEDIAFORMAT_KEY_SAMPLE_RATE, &sampleRate) || channels <= 0 ||
        sampleRate <= 0) {
      return false;
    }
    AMediaFormat_getInt64(format, AMEDIAFORMAT_KEY_DURATION, &_durationUs);
    // After a seek the codec restarts; keep the values established at open
    // (the container may under-report, e.g. half the rate for HE-AAC).
    if (!_formatLocked) {
      _channels = static_cast<std::uint32_t>(channels);
      _sampleRate = static_cast<std::uint32_t>(sampleRate);
    }
    _format = formatName(mime);

    AMediaExtractor_selectTrack(_extractor, track);
    _codec = AMediaCodec_createDecoderByType(mime);
    if (!_codec) return false;
    // Ask for float output; decoders that ignore it deliver 16-bit PCM,
    // which is converted below.
    AMediaFormat_setInt32(format, "pcm-encoding", kEncodingPcmFloat);
    if (AMediaCodec_configure(_codec, format, nullptr, nullptr, 0) != AMEDIA_OK ||
        AMediaCodec_start(_codec) != AMEDIA_OK) {
      return false;
    }
    // Decode until the output format is known: HE-AAC, for example, reports
    // half the real sample rate in the container.
    try {
      while (!_outputFormatKnown && !_outputDone) pump();
    } catch (const std::exception&) {
      return false;
    }
    return _outputFormatKnown || !_pending.empty();
  }

  // One step of the synchronous MediaCodec loop: queue every free input
  // buffer and drain every ready output buffer without waiting; block (up to
  // kDequeueTimeoutUs) only when nothing could be done. The codec runs in a
  // separate media process, so keeping its queues full matters far more than
  // per-call overhead.
  void pump() {
    bool progress = false;
    while (!_inputDone) {
      const ssize_t index = AMediaCodec_dequeueInputBuffer(_codec, 0);
      if (index < 0) break;
      size_t capacity = 0;
      uint8_t* buffer = AMediaCodec_getInputBuffer(_codec, static_cast<size_t>(index), &capacity);
      if (!buffer) {
        throw std::runtime_error("Failed to decode " + _description + ": the codec returned no input buffer");
      }
      const ssize_t size = AMediaExtractor_readSampleData(_extractor, buffer, capacity);
      if (size < 0) {
        AMediaCodec_queueInputBuffer(_codec, static_cast<size_t>(index), 0, 0, 0,
                                     AMEDIACODEC_BUFFER_FLAG_END_OF_STREAM);
        _inputDone = true;
      } else {
        const int64_t time = AMediaExtractor_getSampleTime(_extractor);
        AMediaCodec_queueInputBuffer(_codec, static_cast<size_t>(index), 0, static_cast<size_t>(size),
                                     static_cast<uint64_t>(time), 0);
        AMediaExtractor_advance(_extractor);
      }
      progress = true;
    }

    while (!_outputDone) {
      AMediaCodecBufferInfo info{};
      const ssize_t index = AMediaCodec_dequeueOutputBuffer(_codec, &info, progress ? 0 : kDequeueTimeoutUs);
      if (index >= 0) {
        if (info.size > 0) {
          size_t capacity = 0;
          const uint8_t* buffer = AMediaCodec_getOutputBuffer(_codec, static_cast<size_t>(index), &capacity);
          if (!buffer) {
            AMediaCodec_releaseOutputBuffer(_codec, static_cast<size_t>(index), false);
            throw std::runtime_error("Failed to decode " + _description + ": the codec returned no output buffer");
          }
          append(buffer + info.offset, static_cast<std::size_t>(info.size));
        }
        if (info.flags & AMEDIACODEC_BUFFER_FLAG_END_OF_STREAM) _outputDone = true;
        AMediaCodec_releaseOutputBuffer(_codec, static_cast<size_t>(index), false);
      } else if (index == AMEDIACODEC_INFO_OUTPUT_FORMAT_CHANGED) {
        AMediaFormat* format = AMediaCodec_getOutputFormat(_codec);
        int32_t value = 0;
        std::uint32_t sampleRate = _sampleRate;
        std::uint32_t channels = _channels;
        if (AMediaFormat_getInt32(format, AMEDIAFORMAT_KEY_SAMPLE_RATE, &value) && value > 0) {
          sampleRate = static_cast<std::uint32_t>(value);
        }
        if (AMediaFormat_getInt32(format, AMEDIAFORMAT_KEY_CHANNEL_COUNT, &value) && value > 0) {
          channels = static_cast<std::uint32_t>(value);
        }
        _encoding = AMediaFormat_getInt32(format, "pcm-encoding", &value) ? value : kEncodingPcm16Bit;
        AMediaFormat_delete(format);
        // Callers size their buffers from channels() and interpret samples
        // with sampleRate(): once the decoder is open, they must not change.
        if (_formatLocked && (channels != _channels || sampleRate != _sampleRate)) {
          throw std::runtime_error("Unsupported audio " + _description +
                                   ": the channel layout or sample rate changes mid-stream");
        }
        _channels = channels;
        _sampleRate = sampleRate;
        _outputFormatKnown = true;
      } else if (index != AMEDIACODEC_INFO_OUTPUT_BUFFERS_CHANGED) {
        break; // AMEDIACODEC_INFO_TRY_AGAIN_LATER: nothing ready yet
      }
      progress = true;
    }

    _idlePolls = progress ? 0 : _idlePolls + 1;
    if (_idlePolls > kMaxIdlePolls) {
      throw std::runtime_error("Failed to decode " + _description + ": the decoder stopped responding");
    }
  }

  void append(const uint8_t* bytes, std::size_t size) {
    std::size_t frames = 0;
    if (_encoding == kEncodingPcmFloat) {
      frames = size / (sizeof(float) * _channels);
    } else if (_encoding == kEncodingPcm16Bit) {
      frames = size / (sizeof(int16_t) * _channels);
    } else {
      throw std::runtime_error("Failed to decode " + _description + ": unsupported PCM encoding " +
                               std::to_string(_encoding));
    }

    const auto skip = static_cast<std::size_t>(std::min<std::uint64_t>(frames, _skipFrames));
    _skipFrames -= skip;

    const std::size_t samples = (frames - skip) * _channels;
    const std::size_t first = skip * _channels;
    const std::size_t start = _pending.size();
    _pending.resize(start + samples);
    if (_encoding == kEncodingPcmFloat) {
      std::memcpy(_pending.data() + start, reinterpret_cast<const float*>(bytes) + first, samples * sizeof(float));
    } else {
      const auto* pcm = reinterpret_cast<const int16_t*>(bytes) + first;
      for (std::size_t i = 0; i < samples; ++i) _pending[start + i] = static_cast<float>(pcm[i]) / 32768.0f;
    }
  }

  std::string _description;
  Bytes _data; // keeps in-memory sources alive
  int _fd = -1;
  off64_t _fileSize = 0;
  AMediaDataSource* _dataSource = nullptr;
  AMediaExtractor* _extractor = nullptr;
  AMediaCodec* _codec = nullptr;
  std::string _format;
  std::uint32_t _channels = 0;
  std::uint32_t _sampleRate = 0;
  int64_t _durationUs = 0;
  int32_t _encoding = kEncodingPcm16Bit;
  bool _outputFormatKnown = false;
  /** Set once open succeeded: channels and sample rate are final from then on. */
  bool _formatLocked = false;
  bool _inputDone = false;
  bool _outputDone = false;
  int _idlePolls = 0;
  std::uint64_t _skipFrames = 0;
  std::vector<float> _pending;
  std::size_t _pendingOffset = 0;
};

} // namespace

std::unique_ptr<AudioDecoder> openPlatformFile(const std::string& path) {
  auto decoder = std::make_unique<AndroidDecoder>("\"" + path + "\"", nullptr);
  return decoder->openPath(path) ? std::move(decoder) : nullptr;
}

std::unique_ptr<AudioDecoder> openPlatformMemory(const Bytes& data) {
  if (!__builtin_available(android 28, *)) {
    // AMediaDataSource needs Android 9; say so instead of "unsupported".
    throw std::runtime_error("Unsupported audio data (in-memory, " + std::to_string(data->size()) +
                             " bytes): before Android 9, in-memory sources are limited to WAV, FLAC, MP3 and OGG "
                             "Vorbis. Pass a file path for other formats.");
  }
  auto decoder = std::make_unique<AndroidDecoder>("in-memory data", data);
  return decoder->openMemory() ? std::move(decoder) : nullptr;
}

const char* supportedFormats() noexcept {
  return "supported formats: WAV, FLAC, MP3, OGG Vorbis, AAC/M4A, Opus and other formats the device can decode";
}

} // namespace audioanalyzer::detail

#endif // __ANDROID__
