import {
  decodePeaks,
  encodePeaks,
  fromNativePeaks,
  peaksDuration,
  peaksStartTime,
  type Peaks,
} from '../peaks';
import { makePeaks, toNative } from './fixtures';

function maxError(a: Peaks, b: Peaks): number {
  let error = 0;
  a.channels.forEach((channel, c) => {
    for (const field of ['min', 'max', 'rms'] as const) {
      channel[field].forEach((value, i) => {
        error = Math.max(error, Math.abs(value - b.channels[c]![field][i]!));
      });
    }
  });
  return error;
}

describe('fromNativePeaks', () => {
  it('splits channel-major buffers into channels without copying', () => {
    const peaks = makePeaks(5, { channels: 2 });
    const native = toNative(peaks);
    const restored = fromNativePeaks(native);
    expect(restored.channels).toHaveLength(2);
    expect(Array.from(restored.channels[1]!.rms)).toEqual(
      Array.from(peaks.channels[1]!.rms)
    );
    expect(restored.channels[1]!.rms.buffer).toBe(native.rms);
  });
});

describe('time helpers', () => {
  it('derive start and duration from frames', () => {
    const peaks = makePeaks(10, {
      sampleRate: 1000,
      startFrame: 500,
      frameCount: 2000,
    });
    expect(peaksStartTime(peaks)).toBe(0.5);
    expect(peaksDuration(peaks)).toBe(2);
  });
});

describe('encodePeaks / decodePeaks', () => {
  const peaks = makePeaks(1000, {
    channels: 2,
    startFrame: 12345,
    frameCount: 255_900,
    seed: 11,
  });

  it.each([
    [32, 0],
    [16, 2e-5],
    [8, 0.008],
  ] as const)('round-trips at %i bits within %f', (bits, tolerance) => {
    const decoded = decodePeaks(encodePeaks(peaks, { bits }));
    expect(decoded).toMatchObject({
      sampleRate: peaks.sampleRate,
      framesPerBucket: peaks.framesPerBucket,
      startFrame: 12345,
      frameCount: 255_900,
      length: 1000,
    });
    expect(maxError(peaks, decoded)).toBeLessThanOrEqual(tolerance + 1e-7);
  });

  it('defaults to 8 bits: 3 bytes per bucket and channel', () => {
    expect(encodePeaks(peaks).byteLength).toBe(40 + 2 * 3 * 1000);
  });

  it('8-bit keeps quiet values more precise than loud ones', () => {
    const quiet = makePeaks(1);
    quiet.channels[0]!.rms[0] = 0.01;
    const decoded = decodePeaks(encodePeaks(quiet, { bits: 8 }));
    expect(Math.abs(decoded.channels[0]!.rms[0]! - 0.01)).toBeLessThan(0.001);
  });

  it('integer encodings clamp, 32 bits stores values unchanged', () => {
    const loud = makePeaks(1);
    loud.channels[0]!.max[0] = 1.5;
    expect(
      decodePeaks(encodePeaks(loud, { bits: 16 })).channels[0]!.max[0]
    ).toBe(1);
    expect(
      decodePeaks(encodePeaks(loud, { bits: 32 })).channels[0]!.max[0]
    ).toBe(1.5);
  });

  it('skips header bytes and metrics it does not know (forward compatibility)', () => {
    const original = makePeaks(3, { seed: 2 });
    const encoded = new Uint8Array(encodePeaks(original, { bits: 32 }));
    // Simulate a future writer: a 48-byte header and an extra metric (bit 3)
    // stored after rms.
    const length = 3;
    const future = new Uint8Array(48 + 4 * length * 4);
    future.set(encoded.subarray(0, 40));
    future.set(encoded.subarray(40), 48);
    const view = new DataView(future.buffer);
    view.setUint16(6, 48, true); // headerSize
    view.setUint16(10, 0b1111, true); // min, max, rms + unknown metric
    const decoded = decodePeaks(future.buffer);
    expect(maxError(original, decoded)).toBe(0);
  });

  it('rejects invalid input', () => {
    expect(() => encodePeaks(peaks, { bits: 12 as never })).toThrow(RangeError);
    expect(() => decodePeaks(new ArrayBuffer(10))).toThrow(/too small/);
    expect(() => decodePeaks(new ArrayBuffer(64))).toThrow(/bad magic/);
    const truncated = encodePeaks(peaks).slice(0, 100);
    expect(() => decodePeaks(truncated)).toThrow(/expected/);
    const newer = encodePeaks(peaks);
    new DataView(newer).setUint8(4, 2);
    expect(() => decodePeaks(newer)).toThrow(/version 2/);
  });
});
