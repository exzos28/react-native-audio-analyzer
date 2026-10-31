// Converts the JSON printed by peaks_dump into a .peaks file (16-bit).
import { readFileSync, writeFileSync } from 'node:fs';
import { encodePeaks, type Peaks } from '../../../packages/react-native-audio-analyzer/src/peaks.ts';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error('usage: encode-peaks.mts <input.json> <output.peaks>');
}
const raw = JSON.parse(readFileSync(input, 'utf8'));
const peaks: Peaks = {
  ...raw,
  channels: raw.channels.map((channel: Record<string, number[]>) => ({
    min: Float32Array.from(channel.min!),
    max: Float32Array.from(channel.max!),
    rms: Float32Array.from(channel.rms!),
  })),
};
writeFileSync(output, new Uint8Array(encodePeaks(peaks, { bits: 16 })));
console.log(`  ${peaks.length} buckets × ${peaks.channels.length} channel(s) → ${output}`);
