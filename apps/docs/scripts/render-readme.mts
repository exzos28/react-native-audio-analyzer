// Renders the README images (images/*.svg at the repository root) from real
// analysis results (examples/*.peaks, see examples/README.md) with the
// library's own display code, in a light and a dark variant. Run with
// `yarn workspace docs readme-images` after changing the display code.
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
} from '../../../packages/react-native-audio-analyzer/src/display.ts';
import {
  decodePeaks,
  peaksDuration,
  type Peaks,
} from '../../../packages/react-native-audio-analyzer/src/peaks.ts';

const docs = join(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(docs, '..', '..', 'images');

function load(name: string): Peaks {
  const bytes = readFileSync(join(docs, 'examples', `${name}.peaks`));
  return decodePeaks(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  );
}

const voice = load('voice');
const story = load('story');
const music = load('music');

interface Theme {
  name: 'light' | 'dark';
  background: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  bubble: string;
  onBubble: string;
  onBubbleSoft: string;
}

const themes: Theme[] = [
  {
    name: 'light',
    background: '#ffffff',
    card: '#f6f6fb',
    border: '#e4e4ef',
    text: '#17172b',
    muted: '#6b6b85',
    accent: '#5b4cf0',
    accentSoft: '#c9c3fb',
    bubble: '#5b4cf0',
    onBubble: '#ffffff',
    onBubbleSoft: 'rgba(255,255,255,0.45)',
  },
  {
    name: 'dark',
    background: '#0d1117',
    card: '#161b22',
    border: '#30363d',
    text: '#e6edf3',
    muted: '#8b949e',
    accent: '#8b80ff',
    accentSoft: '#3b3678',
    bubble: '#5b4cf0',
    onBubble: '#ffffff',
    onBubbleSoft: 'rgba(255,255,255,0.45)',
  },
];

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

function bars(
  peaks: Peaks,
  count: number,
  width: number,
  height: number,
  options: { percentile?: number; start?: number; end?: number } = {}
): string {
  const values = resample(peaks, count, {
    start: options.start,
    end: options.end,
  });
  const reference = peaksLevel(peaks, { percentile: options.percentile ?? 1 });
  return waveformPath(normalize(values, { reference }), {
    width,
    height,
    gap: width / count / 3,
    minHeight: 2,
  });
}

function envelope(
  peaks: Peaks,
  count: number,
  width: number,
  height: number,
  range: { start?: number; end?: number } = {}
) {
  return waveformPath(normalizeMinMax(resampleMinMax(peaks, count, range)), {
    width,
    height,
    gap: 0,
    minHeight: 1,
  });
}

function clock(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function svg(width: number, height: number, theme: Theme, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">
<rect width="${width}" height="${height}" rx="16" fill="${theme.background}"/>
${body}
</svg>
`;
}

// ── Banner: logo, name, tagline, and a real waveform ────────────────────────
function banner(theme: Theme): string {
  const width = 880;
  const height = 240;
  const wave = bars(story, 150, 800, 72, { percentile: 0.995 });
  const logo = `<g transform="translate(40 40) scale(2)">
<rect width="32" height="32" rx="8" fill="#5B4CF0"/>
<g fill="#fff"><rect x="6" y="13" width="2.5" height="6" rx="1.25"/><rect x="10.5" y="9" width="2.5" height="14" rx="1.25"/><rect x="15" y="5" width="2.5" height="22" rx="1.25"/><rect x="19.5" y="10" width="2.5" height="12" rx="1.25"/><rect x="24" y="14" width="2.5" height="4" rx="1.25"/></g>
</g>`;
  return svg(
    width,
    height,
    theme,
    `${logo}
<text x="124" y="74" font-size="30" font-weight="700" fill="${theme.text}">react-native-audio-analyzer</text>
<text x="124" y="102" font-size="16" fill="${theme.muted}">Waveforms for React Native. Decode once in C++, draw at any size.</text>
<defs><linearGradient id="wave" x1="0" x2="1" y1="0" y2="0">
<stop offset="0" stop-color="${theme.accent}"/><stop offset="1" stop-color="${theme.accentSoft}"/>
</linearGradient></defs>
<path transform="translate(40 136)" d="${wave}" fill="url(#wave)"/>`
  );
}

// ── Showcase: the three presets on real recordings ──────────────────────────
function showcase(theme: Theme): string {
  const width = 880;
  const height = 300;
  const card = (x: number, w: number, title: string, code: string) =>
    `<rect x="${x}" y="20" width="${w}" height="260" rx="12" fill="${theme.card}" stroke="${theme.border}"/>
<text x="${x + 20}" y="52" font-size="15" font-weight="600" fill="${theme.text}">${title}</text>
<text x="${x + 20}" y="258" font-size="12" font-family="${MONO}" fill="${theme.muted}">${code}</text>`;

  // Chat: a voice message bubble, half played.
  const chatBars = bars(voice, 32, 150, 28, { percentile: 0.99 });
  const chat = `${card(20, 260, 'Voice message', 'waveformPresets.chat')}
<g transform="translate(40 110)">
<rect width="220" height="60" rx="20" fill="${theme.bubble}"/>
<circle cx="30" cy="30" r="16" fill="${theme.onBubble}"/>
<path d="M25 22 L37 30 L25 38 Z" fill="${theme.bubble}"/>
<clipPath id="played-${theme.name}"><rect x="56" y="0" width="75" height="60"/></clipPath>
<path transform="translate(56 16)" d="${chatBars}" fill="${theme.onBubbleSoft}"/>
<path transform="translate(56 16)" d="${chatBars}" fill="${theme.onBubble}" clip-path="url(#played-${theme.name})"/>
<text x="56" y="76" font-size="11" fill="${theme.muted}">${clock(peaksDuration(voice) / 2)} / ${clock(peaksDuration(voice))}</text>
</g>`;

  // Player: an audiobook chapter scrubber with progress.
  const playerBars = bars(story, 64, 240, 56, { percentile: 0.995 });
  const progress = 0.38;
  const player = `${card(300, 280, 'Player', 'waveformPresets.player')}
<g transform="translate(320 108)">
<clipPath id="progress-${theme.name}"><rect width="${240 * progress}" height="56"/></clipPath>
<path d="${playerBars}" fill="${theme.accentSoft}"/>
<path d="${playerBars}" fill="${theme.accent}" clip-path="url(#progress-${theme.name})"/>
<rect x="${240 * progress - 1}" y="-6" width="2" height="68" rx="1" fill="${theme.text}"/>
<text x="0" y="86" font-size="11" fill="${theme.muted}">${clock(peaksDuration(story) * progress)}</text>
<text x="240" y="86" font-size="11" fill="${theme.muted}" text-anchor="end">${clock(peaksDuration(story))}</text>
</g>`;

  // Editor: the signed min/max envelope of two seconds of music.
  const editorPath = envelope(music, 240, 240, 96, { start: 10, end: 12 });
  const editor = `${card(600, 260, 'Editor, 10–12 s', 'resampleMinMax(peaks, 240, range)')}
<g transform="translate(610 90)">
<line x1="0" x2="240" y1="48" y2="48" stroke="${theme.border}"/>
<path d="${editorPath}" fill="${theme.accent}"/>
</g>`;

  return svg(width, height, theme, `${chat}\n${player}\n${editor}`);
}

mkdirSync(output, { recursive: true });
for (const theme of themes) {
  writeFileSync(join(output, `banner-${theme.name}.svg`), banner(theme));
  writeFileSync(join(output, `showcase-${theme.name}.svg`), showcase(theme));
}
console.log(`Rendered README images into ${output}.`);
