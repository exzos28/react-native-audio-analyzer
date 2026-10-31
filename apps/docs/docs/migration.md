---
sidebar_position: 6
title: Migrating from v3
---

# Migrating from v3

| v3 | v4 |
| --- | --- |
| `computeAmplitude(path, 100)` returned an array synchronously | `resample(await analyzeAudio(path), 100)`, or `useWaveform`. Values are RMS instead of the mean absolute level, which is very close visually. |
| Changing the sample count decoded the file again | `resample` the same `Peaks` |
| Returned `[]` for unreadable files | Rejects with a descriptive error |
| `load(url)` cached by file name and size | Caches by full URL; supports headers; rejects non-2xx responses. Files cached by v3 are never read again: `clearCache()` removes them, `getCacheSize()` counts them |
| `react-native-nitro-modules` `^0.27` | `^0.37.1` |

The helpers from the v3 example app map to:

| v3 helper | v4 |
| --- | --- |
| `sample(values, n)` (picked every *n*-th value, could skip peaks) | `resample(peaks, n)` |
| `scale(values)` | `normalize(values)` — keeps silence at 0 |
| `robustScale` / `trimmedScale` | `normalize(values, { reference: peaksLevel(peaks, { percentile: 0.99 }) })` |

The full list of changes is in the [changelog](https://github.com/exzos28/react-native-audio-analyzer/blob/main/packages/react-native-audio-analyzer/CHANGELOG.md).
