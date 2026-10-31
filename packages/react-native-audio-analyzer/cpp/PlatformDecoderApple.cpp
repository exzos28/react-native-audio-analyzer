// Platform decoder for Apple platforms: AudioToolbox's ExtAudioFile, which
// converts any format Core Audio can read (AAC/M4A, ALAC, AIFF, CAF, …) to
// float PCM. Plain C API, so it runs right here in the C++ core.

#if defined(__APPLE__)

#include "Decoders.hpp"

#include <AudioToolbox/AudioToolbox.h>

#include <algorithm>
#include <cstring>
#include <stdexcept>
#include <string>
#include <utility>

namespace audioanalyzer::detail {

namespace {

std::string fourCC(UInt32 code) {
  const char chars[4] = {static_cast<char>((code >> 24) & 0xFF), static_cast<char>((code >> 16) & 0xFF),
                         static_cast<char>((code >> 8) & 0xFF), static_cast<char>(code & 0xFF)};
  std::string text(chars, 4);
  while (!text.empty() && text.back() == ' ') text.pop_back();
  return text;
}

std::string statusText(OSStatus status) {
  return "OSStatus " + std::to_string(status);
}

std::string formatName(UInt32 formatID, UInt32 fileType) {
  switch (formatID) {
    case kAudioFormatMPEG4AAC:
    case kAudioFormatMPEG4AAC_HE:
    case kAudioFormatMPEG4AAC_HE_V2:
    case kAudioFormatMPEG4AAC_LD:
    case kAudioFormatMPEG4AAC_ELD:
      return "aac";
    case kAudioFormatAppleLossless:
      return "alac";
    case kAudioFormatMPEGLayer3:
      return "mp3";
    case kAudioFormatFLAC:
      return "flac";
    case kAudioFormatOpus:
      return "opus";
    case kAudioFormatLinearPCM:
      switch (fileType) {
        case kAudioFileAIFFType:
        case kAudioFileAIFCType:
          return "aiff";
        case kAudioFileCAFType:
          return "caf";
        case kAudioFileWAVEType:
          return "wav";
        default:
          return "pcm";
      }
    default:
      return fourCC(formatID);
  }
}

// AudioFile callbacks for in-memory sources.
OSStatus readBytes(void* client, SInt64 position, UInt32 requested, void* buffer, UInt32* actual) {
  const auto* bytes = static_cast<const std::vector<std::uint8_t>*>(client);
  if (position < 0 || static_cast<std::size_t>(position) >= bytes->size()) {
    *actual = 0;
    return noErr;
  }
  const std::size_t available = bytes->size() - static_cast<std::size_t>(position);
  const std::size_t count = std::min<std::size_t>(requested, available);
  std::memcpy(buffer, bytes->data() + position, count);
  *actual = static_cast<UInt32>(count);
  return noErr;
}

SInt64 byteCount(void* client) {
  return static_cast<SInt64>(static_cast<const std::vector<std::uint8_t>*>(client)->size());
}

class AppleDecoder final : public AudioDecoder {
public:
  AppleDecoder(std::string description, Bytes data) : _description(std::move(description)), _data(std::move(data)) {}

  ~AppleDecoder() override {
    if (_file) ExtAudioFileDispose(_file);
    if (_ownedAudioFile) AudioFileClose(_ownedAudioFile);
  }

  bool openPath(const std::string& path) {
    CFURLRef url = CFURLCreateFromFileSystemRepresentation(nullptr, reinterpret_cast<const UInt8*>(path.data()),
                                                           static_cast<CFIndex>(path.size()), false);
    if (!url) return false;
    const OSStatus status = ExtAudioFileOpenURL(url, &_file);
    CFRelease(url);
    return status == noErr && configure();
  }

  bool openMemory() {
    if (AudioFileOpenWithCallbacks(const_cast<std::vector<std::uint8_t>*>(_data.get()), readBytes, nullptr, byteCount,
                                   nullptr, 0, &_ownedAudioFile) != noErr) {
      _ownedAudioFile = nullptr;
      return false;
    }
    return ExtAudioFileWrapAudioFileID(_ownedAudioFile, false, &_file) == noErr && configure();
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

  std::optional<std::uint64_t> lengthInFrames() override {
    SInt64 frames = 0;
    UInt32 size = sizeof(frames);
    if (ExtAudioFileGetProperty(_file, kExtAudioFileProperty_FileLengthFrames, &size, &frames) != noErr ||
        frames <= 0) {
      return std::nullopt;
    }
    return static_cast<std::uint64_t>(frames);
  }

  std::uint64_t read(float* out, std::uint64_t frameCount) override {
    const auto frames = static_cast<UInt32>(std::min<std::uint64_t>(frameCount, 1u << 20));
    AudioBufferList buffers;
    buffers.mNumberBuffers = 1;
    buffers.mBuffers[0].mNumberChannels = _channels;
    buffers.mBuffers[0].mDataByteSize = frames * _channels * static_cast<UInt32>(sizeof(float));
    buffers.mBuffers[0].mData = out;
    UInt32 framesRead = frames;
    const OSStatus status = ExtAudioFileRead(_file, &framesRead, &buffers);
    if (status != noErr) {
      throw std::runtime_error("Failed to decode " + _description + ": " + statusText(status));
    }
    return framesRead;
  }

  void seek(std::uint64_t frame, const std::atomic<bool>* /*cancelled*/) override {
    const OSStatus status = ExtAudioFileSeek(_file, static_cast<SInt64>(frame));
    if (status != noErr) {
      throw std::runtime_error("Failed to seek in " + _description + ": " + statusText(status));
    }
  }

private:
  bool configure() {
    AudioStreamBasicDescription source{};
    UInt32 size = sizeof(source);
    if (ExtAudioFileGetProperty(_file, kExtAudioFileProperty_FileDataFormat, &size, &source) != noErr ||
        source.mChannelsPerFrame == 0 || source.mSampleRate <= 0) {
      return false;
    }
    _channels = source.mChannelsPerFrame;
    _sampleRate = static_cast<std::uint32_t>(source.mSampleRate);

    // Ask ExtAudioFile to convert to interleaved float at the native rate.
    AudioStreamBasicDescription client{};
    client.mSampleRate = source.mSampleRate;
    client.mFormatID = kAudioFormatLinearPCM;
    client.mFormatFlags = kAudioFormatFlagIsFloat | kAudioFormatFlagIsPacked;
    client.mBitsPerChannel = 32;
    client.mChannelsPerFrame = _channels;
    client.mFramesPerPacket = 1;
    client.mBytesPerFrame = 4 * _channels;
    client.mBytesPerPacket = 4 * _channels;
    if (ExtAudioFileSetProperty(_file, kExtAudioFileProperty_ClientDataFormat, sizeof(client), &client) != noErr) {
      return false;
    }

    UInt32 fileType = 0;
    AudioFileID audioFile = nullptr;
    size = sizeof(audioFile);
    if (ExtAudioFileGetProperty(_file, kExtAudioFileProperty_AudioFile, &size, &audioFile) == noErr && audioFile) {
      size = sizeof(fileType);
      AudioFileGetProperty(audioFile, kAudioFilePropertyFileFormat, &size, &fileType);
    }
    _format = formatName(source.mFormatID, fileType);
    return true;
  }

  std::string _description;
  Bytes _data; // keeps in-memory sources alive
  ExtAudioFileRef _file = nullptr;
  AudioFileID _ownedAudioFile = nullptr;
  std::string _format;
  std::uint32_t _channels = 0;
  std::uint32_t _sampleRate = 0;
};

} // namespace

std::unique_ptr<AudioDecoder> openPlatformFile(const std::string& path) {
  auto decoder = std::make_unique<AppleDecoder>("\"" + path + "\"", nullptr);
  return decoder->openPath(path) ? std::move(decoder) : nullptr;
}

std::unique_ptr<AudioDecoder> openPlatformMemory(const Bytes& data) {
  auto decoder = std::make_unique<AppleDecoder>("in-memory data", data);
  return decoder->openMemory() ? std::move(decoder) : nullptr;
}

const char* supportedFormats() noexcept {
  return "supported formats: WAV, FLAC, MP3, OGG Vorbis, AAC/M4A, ALAC, AIFF, CAF";
}

} // namespace audioanalyzer::detail

#endif // __APPLE__
