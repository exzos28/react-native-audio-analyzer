---
sidebar_position: 3
title: Supported formats
---

# Supported formats

| Format | iOS | Android | Decoder |
| --- | --- | --- | --- |
| WAV, FLAC, MP3, OGG Vorbis | ✅ | ✅ | built-in (miniaudio, stb_vorbis) — identical on both platforms |
| AAC (`.m4a`, `.mp4`, `.aac`) | ✅ | ✅ | platform |
| ALAC, AIFF, CAF | ✅ | ❌ | platform (AudioToolbox) |
| Opus (`.opus`, `.ogg`) | ✅ on recent iOS (verified on iOS 26) | ✅ | platform |
| Anything else | what the OS decodes | what the device decodes | platform |

The built-in decoders are tried first; other files go to the operating system's decoder — AudioToolbox on iOS, MediaCodec on Android. `getAudioInfo` reports which one was used (`decoder: 'builtin' | 'platform'`) and the detected codec (`format`).

Good to know about the platform decoders:

- Lossy decoders differ slightly between platforms, so levels of AAC or Opus files can differ by a fraction of a percent between iOS and Android.
- On Android, decoding runs in the system's media process and is slower than the built-in decoders: about 4 s for 2 minutes of AAC on an emulator, against about 0.2 s for 6 minutes of MP3. Prefer MP3 or OGG Vorbis for long files if analysis time matters.
- On Android, in-memory (`ArrayBuffer`) sources in platform formats need Android 9 or newer, and analyzing a range (`start`) decodes from the beginning of the file.

Unsupported files are rejected with a descriptive error that lists the formats available on the platform.

## How formats are tested

- The built-in decoders are tested on the host (Linux and macOS) under AddressSanitizer and UndefinedBehaviorSanitizer with generated MP3 (with and without a LAME header), FLAC and OGG Vorbis files.
- The AudioToolbox decoder is tested on macOS and in the iOS simulator with AAC (M4A and raw ADTS), ALAC, AIFF and in-memory sources.
- The MediaCodec decoder is tested on an Android emulator with AAC (M4A and ADTS), Opus and in-memory sources.
- An onset test checks that AAC audio lands on the same frame on every platform, from the start of the file and after seeking — encoder-delay mistakes would shift the waveform by about 23 ms.
