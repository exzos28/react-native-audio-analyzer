---
sidebar_position: 1
title: How it works
---

# How it works

```text
source ──► load (download + cache) ──► C++ core (background thread)        JS
                                       miniaudio decode, 4096-frame chunks
                                       └─► buckets: min, max, Σx² ──► Peaks ──► resample ──► normalize ──► draw
```

1. **Resolve the source.** The JS layer validates arguments, converts `file://` URIs to paths and downloads `http(s)://` sources with `load`.
2. **Decode in chunks.** The C++ core opens the source with the built-in decoders (miniaudio, built decode-only, plus stb_vorbis) or, for other formats, the platform decoder — AudioToolbox on iOS, MediaCodec on Android, both called directly from C++ — and decodes it to 32-bit float PCM, 4096 frames at a time.
3. **Fold into buckets.** Each chunk is folded into fixed-size buckets: running minimum, maximum and sum of squares per channel. Working memory is one chunk; the result is 12 bytes per bucket and channel.
4. **Hand over without copying.** The buckets reach JS as `ArrayBuffer`s wrapped in `Float32Array`s.
5. **Resample in JS.** [`resample`](../api/functions/resample) and friends aggregate buckets into bars in time linear in the buckets in view.

## Buckets

A bucket covers `framesPerBucket` frames (a frame is one sample per channel). By default buckets are 256 frames — about 5.8 ms at 44.1 kHz — and grow as needed so the result has at most `maxBuckets` buckets. The last bucket may be partial; resampling weights it by its real number of frames.

Channels are aggregated by default: the minimum and maximum are taken over every channel, and power is averaged. Channels are never summed, so out-of-phase stereo cannot cancel out. Pass `splitChannels: true` to keep them apart and select one with `channel` when resampling.

## Cost

Decoding dominates. Analyzing a 6-minute stereo MP3 (≈ 64 000 buckets) takes about 140 ms on an Apple Silicon Mac and about 0.2 s in a debug build on an Android emulator. Resampling those buckets takes 0.1–0.4 ms in a JavaScript engine with a JIT and a few milliseconds without one — well within a frame.

## Testing

The C++ core is tested on the host under AddressSanitizer and UndefinedBehaviorSanitizer: the accumulator against a naive reference on random signals with every combination of bucket and chunk size, and the decoder on real MP3 (with and without a LAME header) and FLAC files. The JS display layer is tested against frame-by-frame references.
