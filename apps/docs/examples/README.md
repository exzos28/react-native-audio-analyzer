# Example data

Waveform data shown on the docs site, produced by the library's C++ core with
`yarn workspace docs examples:analyze` (see `scripts/analyze-examples.sh`).
Only the analysis results (`.peaks`, 16-bit) are stored here, not the audio.

| File | Source | License |
| --- | --- | --- |
| `voice.peaks` | 20–32 s of *The Ant and the Dove*, read by hzf, from [Children's Short Works, Vol. 025](https://archive.org/details/childrensshortworks025_1804_librivox) (LibriVox) | Public domain |
| `story.peaks` | The whole recording above (63 s) | Public domain |
| `music.peaks` | [`data/16-44100-stereo.flac`](https://github.com/mackron/miniaudio/tree/0.11.25/data) from miniaudio 0.11.25 | Public domain / MIT No Attribution (miniaudio) |
