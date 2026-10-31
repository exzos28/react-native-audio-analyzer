import type { NativePeaks } from '../specs/AudioAnalyzer.nitro';
import type { PeakChannel, Peaks } from '../peaks';

/** Deterministic pseudo-random numbers (mulberry32). */
/* eslint-disable no-bitwise -- the generator is defined in terms of bit operations */
export function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* eslint-enable no-bitwise */

/** Builds plausible peaks for `length` buckets per channel. */
export function makePeaks(
  length: number,
  options: {
    channels?: number;
    framesPerBucket?: number;
    frameCount?: number;
    startFrame?: number;
    sampleRate?: number;
    seed?: number;
  } = {}
): Peaks {
  const {
    channels = 1,
    framesPerBucket = 256,
    sampleRate = 44100,
    startFrame = 0,
    seed = 1,
  } = options;
  const next = random(seed);
  const makeChannel = (): PeakChannel => {
    const channel = {
      min: new Float32Array(length),
      max: new Float32Array(length),
      rms: new Float32Array(length),
    };
    for (let i = 0; i < length; i++) {
      const level = next();
      channel.max[i] = level;
      channel.min[i] = -level * next();
      channel.rms[i] = level * 0.7;
    }
    return channel;
  };
  return {
    sampleRate,
    framesPerBucket,
    startFrame,
    frameCount: options.frameCount ?? length * framesPerBucket,
    length,
    channels: Array.from({ length: channels }, makeChannel),
  };
}

/** Converts peaks to the channel-major buffers the native module returns. */
export function toNative(peaks: Peaks): NativePeaks {
  const pack = (field: keyof PeakChannel) => {
    const out = new Float32Array(peaks.length * peaks.channels.length);
    peaks.channels.forEach((channel, c) =>
      out.set(channel[field], c * peaks.length)
    );
    return out.buffer;
  };
  return {
    sampleRate: peaks.sampleRate,
    channels: peaks.channels.length,
    framesPerBucket: peaks.framesPerBucket,
    startFrame: peaks.startFrame,
    frameCount: peaks.frameCount,
    length: peaks.length,
    min: pack('min'),
    max: pack('max'),
    rms: pack('rms'),
  };
}
