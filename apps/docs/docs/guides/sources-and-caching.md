---
sidebar_position: 4
title: Sources, caching and cancellation
---

# Sources, caching and cancellation

## Sources

Every function that reads audio accepts an `AudioSource`:

```ts
await analyzeAudio('/data/user/0/app/files/note.wav');                     // absolute path
await analyzeAudio('file:///var/mobile/…/voice-note.wav');                 // file:// URI
await analyzeAudio('https://example.com/song.mp3');                        // downloaded and cached
await analyzeAudio({ uri: 'https://api.example.com/a/1', headers: { Authorization: token } });
await analyzeAudio(arrayBufferWithEncodedAudio);                           // in memory
```

Other URI schemes (`content://`, `asset://`, …) are rejected; copy such files to a path first.

## Downloads

`analyzeAudio`, `getAudioInfo` and `useWaveform` download `http(s)://` sources with [`load`](../api/functions/load), which you can also call yourself:

- Files are cached by their full URL, query string included, in `Caches/react-native-audio-analyzer/` (iOS) and `cacheDir/react-native-audio-analyzer/` (Android). Headers are not part of the cache key.
- A cached file is returned immediately and works offline. The operating system may evict it when storage runs low.
- Content at the same URL is not re-validated; put a version in the URL if a file can change.
- Concurrent calls for the same URL and headers share one download. Redirects are followed, including between `http` and `https`; headers are only sent to the origin you requested, never to another host, port or scheme a redirect points to.
- Non-2xx responses reject and are never cached. An interrupted download never leaves a broken file behind.

[`clearCache`](../api/functions/clearCache) deletes the downloaded files; [`getCacheSize`](../api/functions/getCacheSize) returns their size in bytes. Both include files left behind by v3 (`<md5>.audio` in the cache or temporary directory), which v4 never reads, so one `clearCache()` after upgrading frees them.

## Cancellation

```ts
const controller = new AbortController();
const peaks = analyzeAudio(url, { signal: controller.signal });
controller.abort(); // rejects with an AbortError
```

`useWaveform` cancels automatically when the source or analysis options change and when the component unmounts. A download in progress is not interrupted: it finishes in the background and is cached for the next call.

## Cache the analysis

`Peaks` is plain data. Serialize it to skip decoding on the next launch, or compute it on a server and ship the result:

```ts
import { decodePeaks, encodePeaks } from 'react-native-audio-analyzer';

const bytes = encodePeaks(peaks);   // ArrayBuffer
const restored = decodePeaks(bytes);
```

| `bits` | Bytes per bucket and channel | Max error |
| --- | --- | --- |
| `8` (default) | 3 | ≈ 0.008 near full scale, less for quiet values |
| `16` | 6 | ≈ 0.00002 |
| `32` | 12 | lossless |

The format is versioned and forward compatible: newer writers may add header fields and metrics that older readers skip.
