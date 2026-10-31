import {
  fitBars,
  normalize,
  normalizeMinMax,
  peaksLevel,
  resample,
  resampleMinMax,
  waveformPath,
} from '../display';
import type { Peaks } from '../peaks';
import { makePeaks } from './fixtures';

/** Reference: frame-by-frame weighted RMS over equal windows (slow, obviously correct). */
function naiveRms(peaks: Peaks, bars: number): number[] {
  const result: number[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const from = (bar * peaks.frameCount) / bars;
    const to = ((bar + 1) * peaks.frameCount) / bars;
    let sum = 0;
    let weights = 0;
    const steps = 1000;
    for (let s = 0; s < steps; s++) {
      const frame = from + ((to - from) * (s + 0.5)) / steps;
      const bucket = Math.min(
        Math.floor(frame / peaks.framesPerBucket),
        peaks.length - 1
      );
      for (const channel of peaks.channels) {
        sum += channel.rms[bucket]! ** 2;
        weights += 1;
      }
    }
    result.push(Math.sqrt(sum / weights));
  }
  return result;
}

/** Reference: every bucket goes to the bar containing its midpoint. */
function naivePeak(peaks: Peaks, bars: number): number[] {
  const result = new Array<number>(bars).fill(0);
  for (let b = 0; b < peaks.length; b++) {
    const start = b * peaks.framesPerBucket;
    const end = Math.min(start + peaks.framesPerBucket, peaks.frameCount);
    const middle = (start + end) / 2;
    const bar = Math.min(
      bars - 1,
      Math.floor((middle / peaks.frameCount) * bars)
    );
    for (const channel of peaks.channels) {
      result[bar] = Math.max(result[bar]!, -channel.min[b]!, channel.max[b]!);
    }
  }
  return result;
}

describe('resample', () => {
  it('defaults to rms and matches a frame-by-frame reference', () => {
    const peaks = makePeaks(97, { channels: 2, seed: 7 });
    for (const bars of [1, 10, 33, 97, 200]) {
      const actual = Array.from(resample(peaks, bars));
      naiveRms(peaks, bars).forEach((expected, i) =>
        expect(actual[i]).toBeCloseTo(expected, 2)
      );
    }
  });

  it('peak: assigns every bucket to exactly one bar when downsampling', () => {
    const peaks = makePeaks(997, { channels: 2, seed: 9 });
    for (const bars of [1, 7, 50, 300]) {
      const actual = Array.from(resample(peaks, bars, { metric: 'peak' }));
      naivePeak(peaks, bars).forEach((expected, i) =>
        expect(actual[i]).toBeCloseTo(expected, 6)
      );
    }
  });

  it('peak: never loses a transient and never duplicates it', () => {
    const peaks = makePeaks(1000, { seed: 3 });
    const channel = peaks.channels[0]!;
    channel.max.fill(0.1);
    channel.min.fill(-0.1);
    channel.max[537] = 1.5; // one loud bucket
    for (const bars of [7, 10, 333]) {
      const values = Array.from(resample(peaks, bars, { metric: 'peak' }));
      expect(values.filter((v) => v === 1.5)).toHaveLength(1);
    }
  });

  it('weights the partial last bucket by its real number of frames', () => {
    // Two buckets of 100 frames, only 110 frames analyzed.
    const peaks = makePeaks(2, { framesPerBucket: 100, frameCount: 110 });
    peaks.channels[0]!.rms.set([0.2, 0.8]);
    const [rms] = resample(peaks, 1);
    expect(rms).toBeCloseTo(Math.sqrt((0.04 * 100 + 0.64 * 10) / 110), 6);
  });

  it('repeats the covering bucket when zoomed beyond the resolution', () => {
    const peaks = makePeaks(2, { framesPerBucket: 100 });
    peaks.channels[0]!.rms.set([0.2, 0.8]);
    peaks.channels[0]!.max.set([0.3, 0.9]);
    peaks.channels[0]!.min.set([-0.1, -0.1]);
    expect(Array.from(resample(peaks, 4))).toEqual(
      [0.2, 0.2, 0.8, 0.8].map((v) => expect.closeTo(v))
    );
    expect(Array.from(resample(peaks, 4, { metric: 'peak' }))).toEqual(
      [0.3, 0.3, 0.9, 0.9].map((v) => expect.closeTo(v))
    );
  });

  it('resamples a time range in absolute file time', () => {
    // Analyzed from 1 s; buckets of 1 s at 100 Hz.
    const peaks = makePeaks(4, {
      sampleRate: 100,
      framesPerBucket: 100,
      startFrame: 100,
    });
    peaks.channels[0]!.rms.set([0.1, 0.2, 0.3, 0.4]);
    // 2 s…4 s of the file = buckets 1 and 2.
    expect(Array.from(resample(peaks, 2, { start: 2, end: 4 }))).toEqual([
      expect.closeTo(0.2),
      expect.closeTo(0.3),
    ]);
  });

  it('returns zeros outside the analyzed range, also without an end', () => {
    const peaks = makePeaks(2, { sampleRate: 100, framesPerBucket: 100 });
    expect(Array.from(resample(peaks, 2, { start: 5, end: 7 }))).toEqual([
      0, 0,
    ]);
    expect(Array.from(resample(peaks, 2, { start: 5 }))).toEqual([0, 0]);
    expect(
      Array.from(resample(peaks, 2, { start: 5, metric: 'peak' }))
    ).toEqual([0, 0]);
  });

  it('selects a single channel of split peaks', () => {
    const peaks = makePeaks(10, { channels: 2, seed: 5 });
    expect(Array.from(resample(peaks, 10, { channel: 1 }))).toEqual(
      Array.from(peaks.channels[1]!.rms).map((v) => expect.closeTo(v, 6))
    );
  });

  it('validates its arguments', () => {
    const peaks = makePeaks(10);
    expect(() => resample(peaks, -1)).toThrow(RangeError);
    expect(() => resample(peaks, 1.5)).toThrow(RangeError);
    expect(() => resample(peaks, 4, { channel: 3 })).toThrow(RangeError);
    expect(() => resample(peaks, 4, { start: 2, end: 1 })).toThrow(RangeError);
    expect(() => resample(peaks, 4, { metric: 'mean' as never })).toThrow(
      RangeError
    );
  });

  it('handles empty input', () => {
    expect(Array.from(resample(makePeaks(0), 3))).toEqual([0, 0, 0]);
    expect(resample(makePeaks(10), 0)).toHaveLength(0);
  });
});

it.each(['rms', 'peak'] as const)(
  'an empty range gives zero bars for metric %s',
  (metric) => {
    const peaks = makePeaks(40, { seed: 3 });
    const middle = peaks.frameCount / peaks.sampleRate / 2;
    const range = { start: middle, end: middle };
    expect(Array.from(resample(peaks, 5, { ...range, metric }))).toEqual([
      0, 0, 0, 0, 0,
    ]);
    const { min, max } = resampleMinMax(peaks, 3, range);
    expect(Array.from(min)).toEqual([0, 0, 0]);
    expect(Array.from(max)).toEqual([0, 0, 0]);
  }
);

describe('resampleMinMax', () => {
  it('keeps the signed extremes of every window', () => {
    const peaks = makePeaks(4, { framesPerBucket: 10 });
    peaks.channels[0]!.min.set([-0.1, -0.9, -0.2, -0.3]);
    peaks.channels[0]!.max.set([0.5, 0.1, 0.2, 0.7]);
    const { min, max } = resampleMinMax(peaks, 2);
    expect(Array.from(min)).toEqual([
      expect.closeTo(-0.9),
      expect.closeTo(-0.3),
    ]);
    expect(Array.from(max)).toEqual([expect.closeTo(0.5), expect.closeTo(0.7)]);
  });

  it('takes extremes across channels', () => {
    const peaks = makePeaks(1, { channels: 2 });
    peaks.channels[0]!.min[0] = -0.2;
    peaks.channels[1]!.min[0] = -0.6;
    peaks.channels[0]!.max[0] = 0.9;
    peaks.channels[1]!.max[0] = 0.3;
    const { min, max } = resampleMinMax(peaks, 1);
    expect(min[0]).toBeCloseTo(-0.6);
    expect(max[0]).toBeCloseTo(0.9);
  });
});

describe('peaksLevel', () => {
  it('returns the loudest bucket by default', () => {
    const peaks = makePeaks(4);
    peaks.channels[0]!.rms.set([0.1, 0.4, 0.2, 0.3]);
    expect(peaksLevel(peaks)).toBeCloseTo(0.4);
  });

  it('ignores outliers with a percentile', () => {
    const peaks = makePeaks(100);
    peaks.channels[0]!.rms.fill(0.2);
    peaks.channels[0]!.rms[50] = 1;
    expect(peaksLevel(peaks, { percentile: 0.98 })).toBeCloseTo(0.2);
  });

  it('measures peaks and ranges', () => {
    const peaks = makePeaks(4, { sampleRate: 100, framesPerBucket: 100 });
    peaks.channels[0]!.max.set([0.1, 0.9, 0.2, 0.3]);
    peaks.channels[0]!.min.set([-0.1, -0.1, -0.5, -0.1]);
    expect(peaksLevel(peaks, { metric: 'peak' })).toBeCloseTo(0.9);
    expect(peaksLevel(peaks, { metric: 'peak', start: 2 })).toBeCloseTo(0.5);
  });

  it('gives a scale that does not change with zoom or bar count', () => {
    const peaks = makePeaks(1000, { seed: 4 });
    const reference = peaksLevel(peaks);
    // Bucket 10 rendered as one bar while zoomed in, and inside 1000 bars.
    const time = (10.5 * peaks.framesPerBucket) / peaks.sampleRate;
    const zoomed = normalize(
      resample(peaks, 1, { start: time, end: time + 1e-4 }),
      { reference }
    );
    const whole = normalize(resample(peaks, 1000), { reference });
    expect(zoomed[0]).toBeCloseTo(whole[10]!, 5);
  });

  it('is 0 for silence and validates the percentile', () => {
    const silent = makePeaks(3);
    silent.channels[0]!.rms.fill(0);
    expect(peaksLevel(silent)).toBe(0);
    expect(() => peaksLevel(silent, { percentile: 0 })).toThrow(RangeError);
  });
});

describe('normalize', () => {
  it('linear: divides by the largest magnitude and keeps zero at zero', () => {
    expect(Array.from(normalize([0, 0.1, 0.25]))).toEqual([
      0,
      expect.closeTo(0.4),
      1,
    ]);
  });

  it('linear: uses and clamps to a given reference', () => {
    expect(Array.from(normalize([0.1, 0.5], { reference: 0.2 }))).toEqual([
      expect.closeTo(0.5),
      1,
    ]);
  });

  it('db: maps floorDb…0 dB relative to the reference to 0…1', () => {
    const result = normalize([1, 0.1, 0.01, 0.001, 0], {
      scale: 'db',
      floorDb: -40,
    });
    expect(Array.from(result)).toEqual([
      expect.closeTo(1),
      expect.closeTo(0.5),
      expect.closeTo(0),
      0,
      0,
    ]);
  });

  it('returns zeros for silence and never mutates its input', () => {
    expect(Array.from(normalize([0, 0]))).toEqual([0, 0]);
    const values = new Float32Array([0.5, 1]);
    normalize(values);
    expect(Array.from(values)).toEqual([0.5, 1]);
  });

  it('validates options', () => {
    expect(() => normalize([1], { scale: 'db', floorDb: 0 })).toThrow(
      RangeError
    );
    expect(() => normalize([1], { scale: 'nope' as never })).toThrow(
      RangeError
    );
    expect(() => normalize([1], { reference: -1 })).toThrow(RangeError);
  });
});

describe('normalizeMinMax', () => {
  it('uses one reference for both halves', () => {
    const result = normalizeMinMax({
      min: new Float32Array([-0.5]),
      max: new Float32Array([0.25]),
    });
    expect(result.min[0]).toBeCloseTo(-1);
    expect(result.max[0]).toBeCloseTo(0.5);
  });
});

describe('fitBars', () => {
  it('counts bars that fit, gaps between them only', () => {
    expect(fitBars(100, 3, 2)).toBe(20); // 20 * 3 + 19 * 2 = 98
    expect(fitBars(2, 3, 2)).toBe(0);
    expect(() => fitBars(100, 0)).toThrow(RangeError);
  });
});

describe('waveformPath', () => {
  it('draws mirrored bars centered on the middle line', () => {
    expect(
      waveformPath([1, 0.5], { width: 10, height: 20, gap: 1, minHeight: 0 })
    ).toBe('M0 0h4v20h-4ZM5 5h4v10h-4Z');
  });

  it('keeps silent bars visible with minHeight', () => {
    expect(waveformPath([0], { width: 4, height: 10, gap: 0 })).toBe(
      'M0 4.5h4v1h-4Z'
    );
  });

  it('draws an asymmetric envelope', () => {
    const path = waveformPath(
      { min: new Float32Array([-0.5]), max: new Float32Array([1]) },
      { width: 2, height: 20, gap: 0, minHeight: 0 }
    );
    expect(path).toBe('M0 0h2v15h-2Z');
  });

  it('draws an area outline', () => {
    expect(waveformPath([0, 1], { width: 10, height: 20, style: 'area' })).toBe(
      'M0 10L10 0L10 20L0 10Z'
    );
  });

  it('returns an empty path for no data and validates size', () => {
    expect(waveformPath([], { width: 10, height: 10 })).toBe('');
    expect(() => waveformPath([1], { width: 0, height: 10 })).toThrow(
      RangeError
    );
  });
});
