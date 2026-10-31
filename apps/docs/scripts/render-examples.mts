// Renders the waveform examples of the docs site with the library's own
// display code, at build time. Reads examples/*.peaks (real analysis results,
// see examples/README.md) and writes src/generated/examples.json: one SVG path
// per example. Nothing here is hand-drawn.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalize,
  normalizeMinMax,
  peaksLevel,
  resample,
  resampleMinMax,
  waveformPath,
  type Metric,
} from '../../../packages/react-native-audio-analyzer/src/display.ts';
import {
  decodePeaks,
  peaksDuration,
  type Peaks,
} from '../../../packages/react-native-audio-analyzer/src/peaks.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function load(name: string): Peaks {
  const bytes = readFileSync(join(root, 'examples', `${name}.peaks`));
  return decodePeaks(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  );
}

const voice = load('voice');
const story = load('story');
const music = load('music');

interface Example {
  /** SVG path data. */
  d: string;
  width: number;
  height: number;
  /** The library calls that produced it, shown next to the picture. */
  code: string;
}

const examples: Record<string, Example> = {};

function bars(
  id: string,
  peaks: Peaks,
  options: {
    count: number;
    width: number;
    height: number;
    metric?: Metric;
    percentile?: number;
    scale?: 'linear' | 'db';
    raw?: boolean;
    start?: number;
    end?: number;
    gap?: number;
    code: string;
  }
): void {
  const metric = options.metric ?? 'rms';
  const values = resample(peaks, options.count, {
    metric,
    start: options.start,
    end: options.end,
  });
  const scaled = options.raw
    ? values
    : normalize(values, {
        scale: options.scale,
        reference: peaksLevel(peaks, {
          metric,
          percentile: options.percentile ?? 1,
        }),
      });
  examples[id] = {
    d: waveformPath(scaled, {
      width: options.width,
      height: options.height,
      gap: options.gap ?? options.width / options.count / 3,
      minHeight: 2,
    }),
    width: options.width,
    height: options.height,
    code: options.code,
  };
}

function envelope(
  id: string,
  peaks: Peaks,
  options: {
    count: number;
    width: number;
    height: number;
    start?: number;
    end?: number;
    code: string;
  }
): void {
  const range = { start: options.start, end: options.end };
  const scaled = normalizeMinMax(resampleMinMax(peaks, options.count, range));
  examples[id] = {
    d: waveformPath(scaled, {
      width: options.width,
      height: options.height,
      gap: 0,
      minHeight: 1,
    }),
    width: options.width,
    height: options.height,
    code: options.code,
  };
}

// ── Chat bubbles: one voice message, different settings ─────────────────────
const bubble = { count: 40, width: 200, height: 32 };
bars('voice-chat', voice, {
  ...bubble,
  percentile: 0.99,
  code: "useWaveform(url, { ...waveformPresets.chat, barCount: 40 })",
});
bars('voice-peak', voice, {
  ...bubble,
  metric: 'peak',
  code: "resample(peaks, 40, { metric: 'peak' })",
});
bars('voice-db', voice, {
  ...bubble,
  scale: 'db',
  code: "normalize(resample(peaks, 40), { scale: 'db', reference })",
});
bars('voice-raw', voice, {
  ...bubble,
  raw: true,
  code: 'resample(peaks, 40) // not normalized',
});

// ── Track overview and zoom ─────────────────────────────────────────────────
const strip = { width: 720, height: 64 };
bars('story-overview', story, {
  ...strip,
  count: 120,
  percentile: 0.995,
  code: "resample(peaks, 120) // waveformPresets.player",
});
bars('story-zoom', story, {
  ...strip,
  count: 120,
  percentile: 0.995,
  start: 20,
  end: 30,
  code: 'resample(peaks, 120, { start: 20, end: 30 })',
});
bars('music-rms', music, {
  ...strip,
  count: 120,
  code: 'resample(peaks, 120)',
});
bars('music-peak', music, {
  ...strip,
  count: 120,
  metric: 'peak',
  code: "resample(peaks, 120, { metric: 'peak' })",
});
envelope('music-envelope', music, {
  ...strip,
  count: 360,
  code: 'normalizeMinMax(resampleMinMax(peaks, 360))',
});
envelope('music-envelope-zoom', music, {
  ...strip,
  count: 360,
  start: 10,
  end: 12,
  code: 'resampleMinMax(peaks, 360, { start: 10, end: 12 })',
});

const output = {
  sources: {
    voice: { duration: peaksDuration(voice), buckets: voice.length },
    story: { duration: peaksDuration(story), buckets: story.length },
    music: { duration: peaksDuration(music), buckets: music.length },
  },
  examples,
};

mkdirSync(join(root, 'src', 'generated'), { recursive: true });
writeFileSync(
  join(root, 'src', 'generated', 'examples.json'),
  JSON.stringify(output)
);
console.log(`Rendered ${Object.keys(examples).length} waveform examples.`);
