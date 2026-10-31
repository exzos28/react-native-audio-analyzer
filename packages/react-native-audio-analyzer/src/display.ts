import type { PeakChannel, Peaks } from './peaks';

// ── Resampling ──────────────────────────────────────────────────────────────

/**
 * - `rms` (default): root mean square — follows perceived loudness. Speech and
 *   music keep a natural shape; the best default for chat bubbles and players.
 * - `peak`: largest absolute sample — the classic DAW envelope. Never misses a
 *   transient, but dense material (speech, mastered music) looks blocky.
 */
export type Metric = 'rms' | 'peak';

export interface RangeOptions {
  /** Start of the range in seconds (absolute file time). Defaults to the start of the peaks. */
  start?: number;
  /** End of the range in seconds (absolute file time). Defaults to the end of the peaks. */
  end?: number;
  /**
   * Channel index for peaks analyzed with `splitChannels`, or `'mix'`
   * (default) to combine all channels. Mixing takes extremes across channels
   * and averages power, so out-of-phase channels never cancel out.
   */
  channel?: number | 'mix';
}

export interface ResampleOptions extends RangeOptions {
  /** Default `'rms'`. */
  metric?: Metric;
}

export interface MinMax {
  min: Float32Array;
  max: Float32Array;
}

/** A sequence of output windows over the peaks, in frames relative to `peaks.startFrame`. */
interface Window {
  from: number;
  /** Frames per output value (may be fractional). */
  step: number;
  /** First bucket any window can touch. */
  firstBucket: number;
  /** One past the last bucket any window can touch. */
  lastBucket: number;
}

function assertBars(bars: number, fn: string): void {
  if (!Number.isInteger(bars) || bars < 0) {
    throw new RangeError(
      `${fn}: bars must be a non-negative integer, got ${bars}.`
    );
  }
}

function assertMetric(metric: unknown, fn: string): asserts metric is Metric {
  if (metric !== 'rms' && metric !== 'peak') {
    throw new RangeError(
      `${fn}: metric must be 'rms' or 'peak', got ${String(metric)}.`
    );
  }
}

function selectChannels(
  peaks: Peaks,
  channel: number | 'mix' | undefined,
  fn: string
): PeakChannel[] {
  if (channel === undefined || channel === 'mix') {
    return peaks.channels;
  }
  const selected = peaks.channels[channel];
  if (!Number.isInteger(channel) || !selected) {
    throw new RangeError(
      `${fn}: channel must be 'mix' or an index below ${peaks.channels.length}, got ${channel}.`
    );
  }
  return [selected];
}

function windowOf(
  peaks: Peaks,
  count: number,
  options: RangeOptions,
  fn: string
): Window {
  const toFrame = (seconds: number) =>
    seconds * peaks.sampleRate - peaks.startFrame;
  const from = options.start === undefined ? 0 : toFrame(options.start);
  // Without an explicit end, a start beyond the data yields an empty range.
  const to =
    options.end === undefined
      ? Math.max(from, peaks.frameCount)
      : toFrame(options.end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
    throw new RangeError(
      `${fn}: expected start <= end, got start=${options.start}, end=${options.end}.`
    );
  }
  const { framesPerBucket, frameCount, length } = peaks;
  const clampedFrom = Math.max(0, Math.min(frameCount, from));
  const clampedTo = Math.max(0, Math.min(frameCount, to));
  return {
    from,
    step: count > 0 ? (to - from) / count : 0,
    firstBucket: Math.min(length, Math.floor(clampedFrom / framesPerBucket)),
    lastBucket: Math.min(length, Math.ceil(clampedTo / framesPerBucket)),
  };
}

type Series = 'peak' | 'power' | 'min' | 'max';

/**
 * One value per bucket in [first, last) for the selected channels; index 0 of
 * the result is bucket `first`. With several channels, extremes are taken
 * across channels and power is averaged (every channel has the same number of
 * samples per bucket).
 */
function seriesOf(
  channels: PeakChannel[],
  series: Series,
  first: number,
  last: number
): Float32Array {
  const count = channels.length;
  const length = Math.max(0, last - first);
  if (count === 1 && (series === 'min' || series === 'max')) {
    return channels[0]![series].subarray(first, last);
  }
  const out = new Float32Array(length);
  // One tight loop per series and channel: branching inside the per-bucket
  // loop makes it several times slower on JS engines.
  switch (series) {
    case 'peak':
      for (const { min, max } of channels) {
        for (let i = 0; i < length; i++) {
          const magnitude = Math.max(-min[first + i]!, max[first + i]!);
          if (magnitude > out[i]!) out[i] = magnitude;
        }
      }
      break;
    case 'power':
      for (const { rms } of channels) {
        for (let i = 0; i < length; i++) {
          const value = rms[first + i]!;
          out[i]! += (value * value) / count;
        }
      }
      break;
    case 'min':
    case 'max': {
      const takeMax = series === 'max';
      out.set(channels[0]![series].subarray(first, last));
      for (let c = 1; c < count; c++) {
        const values = channels[c]![series];
        for (let i = 0; i < length; i++) {
          const value = values[first + i]!;
          if (takeMax ? value > out[i]! : value < out[i]!) out[i] = value;
        }
      }
      break;
    }
  }
  return out;
}

/**
 * Frame-weighted average of `values` over every window: buckets count in
 * proportion to their overlap with the window, so fractional window edges and
 * the partial last bucket are weighted exactly. Runs in O(buckets + bars).
 */
function weightedAverage(
  values: Float32Array,
  peaks: Peaks,
  window: Window,
  out: Float32Array
): void {
  const { framesPerBucket, frameCount } = peaks;
  const { firstBucket, lastBucket } = window;
  for (let bar = 0; bar < out.length; bar++) {
    const start = Math.max(0, window.from + bar * window.step);
    const stop = Math.min(frameCount, window.from + (bar + 1) * window.step);
    let sum = 0;
    let weight = 0;
    for (
      let b = Math.max(firstBucket, Math.floor(start / framesPerBucket));
      b < lastBucket;
      b++
    ) {
      const bucketStart = b * framesPerBucket;
      if (bucketStart >= stop) break;
      const bucketEnd = Math.min(bucketStart + framesPerBucket, frameCount);
      const overlap = Math.min(stop, bucketEnd) - Math.max(start, bucketStart);
      if (overlap > 0) {
        sum += values[b - firstBucket]! * overlap;
        weight += overlap;
      }
    }
    out[bar] = weight > 0 ? sum / weight : 0;
  }
}

/**
 * Largest (or smallest) value per window. Each bucket belongs to the window
 * containing its midpoint, so when downsampling every bucket counts exactly
 * once: no peak is lost and none is counted twice in neighbouring bars. When
 * a window is narrower than a bucket (zoomed in), it takes the bucket under
 * its center. Windows outside the analyzed range are 0.
 */
function extreme(
  values: Float32Array,
  takeMax: boolean,
  peaks: Peaks,
  window: Window,
  out: Float32Array
): void {
  const { framesPerBucket, frameCount, length } = peaks;
  const { firstBucket, lastBucket } = window;
  const half = framesPerBucket / 2;
  // First bucket whose midpoint is at or after `edge`; the ends of the
  // analyzed range own everything beyond them.
  const owner = (edge: number) =>
    edge <= 0
      ? 0
      : edge >= frameCount
        ? length
        : Math.ceil((edge - half) / framesPerBucket);
  for (let bar = 0; bar < out.length; bar++) {
    const start = window.from + bar * window.step;
    const stop = window.from + (bar + 1) * window.step;
    // An empty window (start === end) covers no audio, as with 'rms'.
    if (stop <= start || stop <= 0 || start >= frameCount) {
      out[bar] = 0;
      continue;
    }
    let first = Math.max(firstBucket, owner(start));
    let last = Math.min(lastBucket, owner(stop));
    if (first >= last) {
      // Narrower than a bucket: use the bucket under the window's center.
      const center = Math.min(frameCount - 1, Math.max(0, (start + stop) / 2));
      first = Math.min(
        lastBucket - 1,
        Math.max(firstBucket, Math.floor(center / framesPerBucket))
      );
      last = first + 1;
    }
    let result = values[first - firstBucket]!;
    for (let b = first + 1; b < last; b++) {
      const value = values[b - firstBucket]!;
      if (takeMax ? value > result : value < result) result = value;
    }
    out[bar] = result;
  }
}

/**
 * Aggregates peaks into `bars` values (0…1) for drawing. Every value covers an
 * equal share of the range; buckets are aggregated, never skipped, so the
 * waveform stays stable when the bar count changes. When zoomed in beyond the
 * analyzed resolution, neighbouring bars repeat the bucket they fall into.
 *
 * Runs in time linear in the buckets of the range plus `bars`.
 *
 * @example
 * const bars = normalize(resample(peaks, 48)); // 48 bars, whole file
 * const zoomed = resample(peaks, 200, { start: 30, end: 40, metric: 'peak' });
 */
export function resample(
  peaks: Peaks,
  bars: number,
  options: ResampleOptions = {}
): Float32Array {
  assertBars(bars, 'resample');
  const metric = options.metric ?? 'rms';
  assertMetric(metric, 'resample');
  const channels = selectChannels(peaks, options.channel, 'resample');
  const out = new Float32Array(bars);
  if (bars === 0 || peaks.length === 0) return out;
  const window = windowOf(peaks, bars, options, 'resample');
  const { firstBucket, lastBucket } = window;
  if (firstBucket >= lastBucket) return out;

  if (metric === 'peak') {
    const values = seriesOf(channels, 'peak', firstBucket, lastBucket);
    extreme(values, true, peaks, window, out);
  } else {
    const values = seriesOf(channels, 'power', firstBucket, lastBucket);
    weightedAverage(values, peaks, window, out);
    for (let i = 0; i < out.length; i++) out[i] = Math.sqrt(out[i]!);
  }
  return out;
}

/**
 * Signed envelope: the smallest and largest sample under every bar (-1…1).
 * Draw `max` above the center line and `min` below it for an asymmetric,
 * DAW-style waveform.
 */
export function resampleMinMax(
  peaks: Peaks,
  bars: number,
  options: RangeOptions = {}
): MinMax {
  assertBars(bars, 'resampleMinMax');
  const channels = selectChannels(peaks, options.channel, 'resampleMinMax');
  const min = new Float32Array(bars);
  const max = new Float32Array(bars);
  if (bars === 0 || peaks.length === 0) return { min, max };
  const window = windowOf(peaks, bars, options, 'resampleMinMax');
  const { firstBucket, lastBucket } = window;
  if (firstBucket >= lastBucket) return { min, max };
  const lows = seriesOf(channels, 'min', firstBucket, lastBucket);
  const highs = seriesOf(channels, 'max', firstBucket, lastBucket);
  extreme(lows, false, peaks, window, min);
  extreme(highs, true, peaks, window, max);
  return { min, max };
}

// ── Reference level ─────────────────────────────────────────────────────────

export interface LevelOptions extends RangeOptions {
  /** Default `'rms'`. */
  metric?: Metric;
  /**
   * Percentile (0…1] of the bucket levels to use. `1` (default) is the
   * maximum; `0.99` ignores the loudest 1% of buckets (clicks, plosives), so
   * they don't flatten everything else.
   */
  percentile?: number;
}

/**
 * Loudness reference of the peaks, computed over buckets rather than over a
 * resampled view. Pass it to {@link normalize} as `reference` so the scale of
 * a waveform does not change when you zoom or change the bar count.
 *
 * Returns 0 for silence.
 */
export function peaksLevel(peaks: Peaks, options: LevelOptions = {}): number {
  const metric = options.metric ?? 'rms';
  assertMetric(metric, 'peaksLevel');
  const percentile = options.percentile ?? 1;
  if (!(percentile > 0 && percentile <= 1)) {
    throw new RangeError(
      `peaksLevel: percentile must be in (0, 1], got ${percentile}.`
    );
  }
  const channels = selectChannels(peaks, options.channel, 'peaksLevel');
  if (peaks.length === 0) return 0;
  const { firstBucket, lastBucket } = windowOf(peaks, 1, options, 'peaksLevel');
  if (firstBucket >= lastBucket) return 0;

  const values = seriesOf(
    channels,
    metric === 'peak' ? 'peak' : 'power',
    firstBucket,
    lastBucket
  );
  const toLevel = metric === 'peak' ? (v: number) => v : Math.sqrt;
  if (percentile === 1) {
    let max = 0;
    for (let i = 0; i < values.length; i++) {
      if (values[i]! > max) max = values[i]!;
    }
    return toLevel(max);
  }
  const sorted = Float32Array.from(values).sort();
  return toLevel(sorted[Math.floor((sorted.length - 1) * percentile)]!);
}

// ── Normalization ───────────────────────────────────────────────────────────

export interface NormalizeOptions {
  /**
   * - `linear` (default): divide by the reference. Keeps silence at 0 and the
   *   proportions between bars.
   * - `db`: decibels relative to the reference, mapped from `floorDb`…0 dB to
   *   0…1. Brings out quiet passages.
   */
  scale?: 'linear' | 'db';
  /**
   * Level that maps to 1. Defaults to the largest magnitude of the input; use
   * {@link peaksLevel} for a stable scale across zoom levels and bar counts.
   * Values above the reference are clamped.
   */
  reference?: number;
  /** Level mapped to 0 by `scale: 'db'`, in dB relative to the reference. Default -40. */
  floorDb?: number;
}

function maxAbs(arrays: ArrayLike<number>[]): number {
  let result = 0;
  for (const values of arrays) {
    for (let i = 0; i < values.length; i++) {
      const value = Math.abs(values[i]!);
      if (value > result) result = value;
    }
  }
  return result;
}

function normalizer(
  arrays: ArrayLike<number>[],
  options: NormalizeOptions,
  fn: string
): (value: number) => number {
  const scale = options.scale ?? 'linear';
  if (scale !== 'linear' && scale !== 'db') {
    throw new RangeError(
      `${fn}: scale must be 'linear' or 'db', got ${String(scale)}.`
    );
  }
  const floorDb = options.floorDb ?? -40;
  if (!(Number.isFinite(floorDb) && floorDb < 0)) {
    throw new RangeError(
      `${fn}: floorDb must be a negative number, got ${floorDb}.`
    );
  }
  const reference = options.reference ?? maxAbs(arrays);
  if (!(Number.isFinite(reference) && reference >= 0)) {
    throw new RangeError(
      `${fn}: reference must be a finite number >= 0, got ${reference}.`
    );
  }
  if (reference === 0) return () => 0;

  if (scale === 'linear') {
    return (value) => Math.max(-1, Math.min(1, value / reference));
  }
  return (value) => {
    const magnitude = Math.abs(value) / reference;
    if (magnitude === 0) return 0;
    const level = (20 * Math.log10(magnitude) - floorDb) / -floorDb;
    return Math.sign(value) * Math.max(0, Math.min(1, level));
  };
}

function mapValues(
  values: ArrayLike<number>,
  map: (value: number) => number
): Float32Array {
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = map(values[i]!);
  return out;
}

/** Scales values for display; see {@link NormalizeOptions}. Never mutates its input. */
export function normalize(
  values: ArrayLike<number>,
  options: NormalizeOptions = {}
): Float32Array {
  return mapValues(values, normalizer([values], options, 'normalize'));
}

/**
 * Scales a signed envelope from {@link resampleMinMax}, using one reference
 * for both halves so the waveform keeps its shape.
 */
export function normalizeMinMax(
  envelope: MinMax,
  options: NormalizeOptions = {}
): MinMax {
  const map = normalizer(
    [envelope.min, envelope.max],
    options,
    'normalizeMinMax'
  );
  return {
    min: mapValues(envelope.min, map),
    max: mapValues(envelope.max, map),
  };
}

// ── Drawing helpers ─────────────────────────────────────────────────────────

/** Number of bars of `barWidth` separated by `gap` that fit into `width`. */
export function fitBars(width: number, barWidth: number, gap = 0): number {
  if (!(width >= 0) || !(barWidth > 0) || !(gap >= 0)) {
    throw new RangeError(
      `fitBars: expected width >= 0, barWidth > 0, gap >= 0, got ${width}, ${barWidth}, ${gap}.`
    );
  }
  return Math.max(0, Math.floor((width + gap) / (barWidth + gap)));
}

export interface WaveformPathOptions {
  width: number;
  height: number;
  /**
   * - `bars` (default): one rectangle per value.
   * - `area`: a single filled outline through all values.
   */
  style?: 'bars' | 'area';
  /** Space between bars (style `bars`). Default 1. */
  gap?: number;
  /** Minimum bar height so silence stays visible (style `bars`). Default 1. */
  minHeight?: number;
}

function format(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function isEnvelope(data: ArrayLike<number> | MinMax): data is MinMax {
  return (
    typeof (data as MinMax).min === 'object' &&
    typeof (data as MinMax).max === 'object'
  );
}

/**
 * Builds an SVG path (`d` attribute) for a waveform, usable with
 * react-native-svg's `<Path d={…} />` or Skia's `Skia.Path.MakeFromSVGString`.
 *
 * Pass normalized values (0…1) for a waveform mirrored around the center
 * line, or a normalized signed envelope ({@link resampleMinMax} +
 * {@link normalizeMinMax}) for an asymmetric one.
 */
export function waveformPath(
  data: ArrayLike<number> | MinMax,
  options: WaveformPathOptions
): string {
  const { width, height, style = 'bars', gap = 1, minHeight = 1 } = options;
  if (!(width > 0) || !(height > 0)) {
    throw new RangeError(
      `waveformPath: width and height must be positive, got ${width}x${height}.`
    );
  }
  const envelope = isEnvelope(data) ? data : null;
  const top: ArrayLike<number> = envelope
    ? envelope.max
    : (data as ArrayLike<number>);
  const count = top.length;
  if (count === 0) return '';

  const middle = height / 2;
  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  const yTop = (i: number) => middle - clamp(top[i]!) * middle;
  const yBottom = envelope
    ? (i: number) => middle - clamp(envelope.min[i]!) * middle
    : (i: number) => middle + clamp(top[i]!) * middle;

  if (style === 'area') {
    const x = (i: number) =>
      count === 1 ? width / 2 : (i * width) / (count - 1);
    let path = `M${format(x(0))} ${format(yTop(0))}`;
    for (let i = 1; i < count; i++) {
      path += `L${format(x(i))} ${format(yTop(i))}`;
    }
    for (let i = count - 1; i >= 0; i--) {
      path += `L${format(x(i))} ${format(yBottom(i))}`;
    }
    return `${path}Z`;
  }

  const slot = width / count;
  const barWidth = Math.max(slot - gap, Math.min(slot, 0.5));
  let path = '';
  for (let i = 0; i < count; i++) {
    let y1 = yTop(i);
    let y2 = yBottom(i);
    if (y2 - y1 < minHeight) {
      const center = (y1 + y2) / 2;
      y1 = center - minHeight / 2;
      y2 = center + minHeight / 2;
    }
    path += `M${format(i * slot)} ${format(y1)}h${format(barWidth)}v${format(y2 - y1)}h${format(-barWidth)}Z`;
  }
  return path;
}
