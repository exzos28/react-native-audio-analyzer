---
sidebar_position: 7
title: Troubleshooting
---

# Troubleshooting

**Errors about a missing Nitro module or an unregistered `AudioAnalyzer` hybrid object.**
The native code is not linked. Run `pod install` (or `npx expo prebuild`) and rebuild the app; a JS reload is not enough. In Expo, use a development build, not Expo Go.

**`Unsupported or corrupted audio file`.**
Neither the built-in decoders nor the platform can read the file — the message lists the formats available on that platform ([table](./formats)) — or the download is not an audio file, for example an HTML error page from a server that answers with status 200. Open the URL in a browser.

**The waveform looks flat.**
Heavily compressed music has a nearly constant level. Zoom in (`view` / `start` / `end`) to see the rhythm, or use `scale: 'db'`.

**All bars are maxed out.**
A few loud spots set a low reference — use `percentile: 0.99` — or `scale: 'db'` lifts everything; switch back to `'linear'`.

**`load()` rejects on Android with a cleartext error.**
Android blocks `http://` by default. Use `https://`, or allow cleartext traffic for the domain in a network security config.

**Analysis of a range in a long MP3 is slow to start.**
MP3 has no index: reaching `start` decodes from the beginning of the file. Analyze the whole file once and zoom with `resample` instead.
