# react-native-audio-analyzer

## 4.0.1

### Patch Changes

- [`3623c12`](https://github.com/exzos28/react-native-audio-analyzer/commit/3623c12b5228def09949e77879f256b087f95cb5) Thanks [@exzos28](https://github.com/exzos28)! - The npm package page links to the documentation site.

## 4.0.0

### Major Changes

- [`e3a7431`](https://github.com/exzos28/react-native-audio-analyzer/commit/e3a7431fa3baf61680b69a3cf1c64d1dd4531ba9) Thanks [@exzos28](https://github.com/exzos28)! - **v4: decode once, render many.**

  New API:

  - `analyzeAudio(source, options)` decodes a file once, on a background thread with bounded memory, and returns `Peaks`: min, max and RMS per bucket as `Float32Array`s. Options: `maxBuckets` (default 100 000) or an exact `framesPerBucket`, `splitChannels`, a `start`/`end` range, cancellation with `AbortSignal` and `onProgress`.
  - `resample(peaks, bars, { metric, start, end, channel })` and `resampleMinMax(peaks, bars, options)` turn peaks into any number of bars over any time range without decoding again. RMS is weighted by frames; for peaks every bucket belongs to exactly one bar, so a transient is never lost or drawn twice.
  - `peaksLevel(peaks, { metric, percentile })` computes a reference level over the whole file; `normalize` / `normalizeMinMax` scale values linearly or in decibels against it, so zooming never rescales the waveform.
  - `waveformPath` builds SVG/Skia paths; `fitBars` computes how many bars fit.
  - `useWaveform(source, options)` React hook: status, progress, cancellation on unmount or source change, `bars` as a plain array, display errors reported as state, and analysis options kept separate from display options.
  - `waveformPresets.chat`, `.player` and `.editor`: plain option objects tuned for voice messages, scrubbers and precise views.
  - `getAudioInfo(source)` returns format, sample rate, channel count and duration.
  - `encodePeaks` / `decodePeaks` serialize peaks in a versioned, forward-compatible binary format (8, 16 or 32 bits per value).
  - Sources can be file paths, `file://` URIs, `http(s)://` URLs (downloaded and cached), `{ uri, headers }` or `ArrayBuffer`s with encoded audio.
  - `load(url, { headers })` shares concurrent downloads of the same URL and headers; `clearCache()` and `getCacheSize()`. Headers are never forwarded to another origin on redirects.

  Breaking changes:

  - `computeAmplitude` is removed. Use `resample(await analyzeAudio(source), n)` or `useWaveform`.
  - The v3 example helpers (`scale`, `sample`, `robustScale`, `trimmedScale`) are replaced by `resample`, `normalize` and `peaksLevel`.
  - `load()` only accepts `http://`/`https://` URLs. Files are cached by the full URL in the app's caches directory; non-2xx responses reject and are never cached; interrupted downloads no longer leave truncated files behind. Files cached by v3 are not reused; `clearCache()` removes them and `getCacheSize()` counts them.
  - Requires `react-native-nitro-modules` `^0.37.1`.

  Fixes:

  - Analysis no longer drops the last frames when the container states a shorter duration than the decoder delivers: without an `end`, it reads to the end of the stream.
  - Fractional or negative sample counts no longer read out of bounds or divide by zero.
  - Android: the downloader has the no-argument constructor that Nitro's autolinking requires, and follows redirects between `http` and `https`.
  - miniaudio is compiled with optimizations even in debug builds. Previously Android debug builds compiled it at -O0 (Gradle's `cppFlags` don't apply to C files), which made a 6-minute MP3 take ~10 s instead of ~0.2 s on an emulator; iOS Debug had the same issue.
  - miniaudio updated to 0.11.25 and built decode-only (no playback/capture backends), which shrinks the native binary and drops the AVFoundation/OpenSL ES dependencies.
  - New formats: OGG Vorbis on every platform (built-in, via stb_vorbis), and everything the operating system can decode through a platform decoder called directly from C++ — AAC/M4A on iOS and Android, ALAC/AIFF/CAF on iOS, Opus on Android. `getAudioInfo` reports the detected codec and which decoder was used.
