import type { NativePeaks } from './specs/AudioAnalyzer.nitro';

/** Statistics of one channel, one value per bucket. */
export interface PeakChannel {
  /** Smallest sample in each bucket (-1…1, signed). */
  min: Float32Array;
  /** Largest sample in each bucket (-1…1, signed). */
  max: Float32Array;
  /** Root mean square of each bucket (0…1): follows perceived loudness. */
  rms: Float32Array;
}

/**
 * Result of {@link analyzeAudio}: per-bucket statistics of a decoded audio
 * file (or a range of it) at a fixed resolution of `framesPerBucket` frames.
 *
 * Plain data: it can be cached, serialized with {@link encodePeaks} and turned
 * into any number of bars with {@link resample} without decoding again.
 * Treat it as immutable.
 */
export interface Peaks {
  sampleRate: number;
  /** Frames (samples per channel) per bucket. */
  framesPerBucket: number;
  /** First analyzed frame, relative to the start of the file. */
  startFrame: number;
  /** Number of analyzed frames. The last bucket may cover fewer frames. */
  frameCount: number;
  /** Buckets per channel. */
  length: number;
  /** One entry for mixed channels (default), one per channel with `splitChannels`. */
  channels: PeakChannel[];
}

/** Start of the analyzed range, in seconds. */
export function peaksStartTime(peaks: Peaks): number {
  return peaks.startFrame / peaks.sampleRate;
}

/** Duration of the analyzed range, in seconds. */
export function peaksDuration(peaks: Peaks): number {
  return peaks.frameCount / peaks.sampleRate;
}

/** Wraps native buffers (channel-major Float32) without copying. */
export function fromNativePeaks(native: NativePeaks): Peaks {
  const { length, channels } = native;
  const view = (buffer: ArrayBuffer, channel: number) =>
    new Float32Array(buffer, channel * length * 4, length);
  return {
    sampleRate: native.sampleRate,
    framesPerBucket: native.framesPerBucket,
    startFrame: native.startFrame,
    frameCount: native.frameCount,
    length,
    channels: Array.from({ length: channels }, (_, channel) => ({
      min: view(native.min, channel),
      max: view(native.max, channel),
      rms: view(native.rms, channel),
    })),
  };
}

// ── Binary serialization ────────────────────────────────────────────────────
//
// Version 1 layout, little-endian:
//
//   offset size  field
//        0    4  magic "RNAP"
//        4    1  version (1)
//        5    1  encoding: 0 = float32, 1 = 16-bit linear, 2 = 8-bit sqrt-companded
//        6    2  headerSize: offset of the data (40 in v1; readers skip any extra header bytes)
//        8    2  channel count
//       10    2  metric mask: bit 0 min, bit 1 max, bit 2 rms (readers skip unknown metrics)
//       12    4  sampleRate
//       16    4  framesPerBucket
//       20    4  length (buckets per channel)
//       24    8  startFrame (float64)
//       32    8  frameCount (float64)
//   headerSize   data: for every channel, every metric in the mask in bit order, `length` values
//
// Signed metrics (min, max) use the signed integer types, unsigned ones (rms)
// the unsigned types. 8-bit stores sign(x)·sqrt(|x|), which keeps more
// resolution for quiet passages than linear 8-bit. The integer encodings clamp
// values outside -1…1 (0…1 for rms); float32 stores them unchanged.

const MAGIC = [0x52, 0x4e, 0x41, 0x50]; // "RNAP"
const VERSION = 1;
const HEADER_SIZE = 40;

const Encoding = { Float32: 0, Linear16: 1, Sqrt8: 2 } as const;
type Encoding = (typeof Encoding)[keyof typeof Encoding];

const METRICS = ['min', 'max', 'rms'] as const;
type MetricName = (typeof METRICS)[number];
const SIGNED: Record<MetricName, boolean> = {
  min: true,
  max: true,
  rms: false,
};
const ALL_METRICS = 0b111;

export type PeaksBits = 8 | 16 | 32;

export interface EncodePeaksOptions {
  /** Bits per value. Defaults to 8: 3 bytes per bucket and channel. */
  bits?: PeaksBits;
}

const BYTES: Record<Encoding, number> = {
  [Encoding.Float32]: 4,
  [Encoding.Linear16]: 2,
  [Encoding.Sqrt8]: 1,
};

const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Serializes peaks into a compact binary buffer, e.g. to cache them on disk
 * or send them from a server. Decode with {@link decodePeaks}.
 *
 * | bits | bytes per bucket and channel | max error |
 * | ---- | ---------------------------- | --------- |
 * | 8    | 3                            | ≈ 0.008 near full scale, less for quiet values |
 * | 16   | 6                            | ≈ 0.00002 |
 * | 32   | 12                           | lossless  |
 */
export function encodePeaks(
  peaks: Peaks,
  options: EncodePeaksOptions = {}
): ArrayBuffer {
  const bits = options.bits ?? 8;
  const encoding =
    bits === 32
      ? Encoding.Float32
      : bits === 16
        ? Encoding.Linear16
        : bits === 8
          ? Encoding.Sqrt8
          : undefined;
  if (encoding === undefined) {
    throw new RangeError(`encodePeaks: bits must be 8, 16 or 32, got ${bits}.`);
  }
  const { length } = peaks;
  const bytes = BYTES[encoding];
  const channelCount = peaks.channels.length;
  const buffer = new ArrayBuffer(
    HEADER_SIZE + channelCount * METRICS.length * length * bytes
  );

  const header = new DataView(buffer, 0, HEADER_SIZE);
  MAGIC.forEach((byte, i) => header.setUint8(i, byte));
  header.setUint8(4, VERSION);
  header.setUint8(5, encoding);
  header.setUint16(6, HEADER_SIZE, true);
  header.setUint16(8, channelCount, true);
  header.setUint16(10, ALL_METRICS, true);
  header.setUint32(12, peaks.sampleRate, true);
  header.setUint32(16, peaks.framesPerBucket, true);
  header.setUint32(20, length, true);
  header.setFloat64(24, peaks.startFrame, true);
  header.setFloat64(32, peaks.frameCount, true);

  let offset = HEADER_SIZE;
  const view = new DataView(buffer);
  for (const channel of peaks.channels) {
    for (const metric of METRICS) {
      const values = channel[metric];
      const signed = SIGNED[metric];
      const lo = signed ? -1 : 0;
      for (let i = 0; i < length; i++) {
        // 32 bits stores values as they are; integer encodings clamp.
        const value =
          encoding === Encoding.Float32 ? values[i]! : clamp(values[i]!, lo, 1);
        switch (encoding) {
          case Encoding.Float32:
            view.setFloat32(offset, value, true);
            break;
          case Encoding.Linear16:
            if (signed) view.setInt16(offset, Math.round(value * 32767), true);
            else view.setUint16(offset, Math.round(value * 65535), true);
            break;
          case Encoding.Sqrt8: {
            const companded = Math.sign(value) * Math.sqrt(Math.abs(value));
            if (signed) view.setInt8(offset, Math.round(companded * 127));
            else view.setUint8(offset, Math.round(companded * 255));
            break;
          }
        }
        offset += bytes;
      }
    }
  }
  return buffer;
}

/** Reads `length` values starting at `offset` and converts them to floats. */
function readValues(
  buffer: ArrayBuffer,
  offset: number,
  length: number,
  encoding: Encoding,
  signed: boolean
): Float32Array {
  const out = new Float32Array(length);
  const aligned = LITTLE_ENDIAN && offset % BYTES[encoding] === 0;
  if (encoding === Encoding.Float32) {
    if (aligned) {
      out.set(new Float32Array(buffer, offset, length));
    } else {
      const view = new DataView(buffer, offset, length * 4);
      for (let i = 0; i < length; i++) out[i] = view.getFloat32(i * 4, true);
    }
  } else if (encoding === Encoding.Linear16) {
    const scale = signed ? 32767 : 65535;
    if (aligned) {
      const source = signed
        ? new Int16Array(buffer, offset, length)
        : new Uint16Array(buffer, offset, length);
      for (let i = 0; i < length; i++) out[i] = source[i]! / scale;
    } else {
      const view = new DataView(buffer, offset, length * 2);
      for (let i = 0; i < length; i++) {
        out[i] =
          (signed ? view.getInt16(i * 2, true) : view.getUint16(i * 2, true)) /
          scale;
      }
    }
  } else {
    const source = signed
      ? new Int8Array(buffer, offset, length)
      : new Uint8Array(buffer, offset, length);
    const scale = signed ? 127 : 255;
    for (let i = 0; i < length; i++) {
      const companded = source[i]! / scale;
      out[i] = Math.sign(companded) * companded * companded;
    }
  }
  return out;
}

/** Restores peaks serialized with {@link encodePeaks}. */
/* eslint-disable no-bitwise -- the header stores metrics as a bit mask */
export function decodePeaks(buffer: ArrayBuffer): Peaks {
  if (buffer.byteLength < HEADER_SIZE) {
    throw new TypeError('decodePeaks: buffer is too small to contain peaks.');
  }
  const header = new DataView(buffer, 0, HEADER_SIZE);
  if (MAGIC.some((byte, i) => header.getUint8(i) !== byte)) {
    throw new TypeError('decodePeaks: not a peaks buffer (bad magic).');
  }
  const version = header.getUint8(4);
  if (version !== VERSION) {
    throw new TypeError(`decodePeaks: unsupported version ${version}.`);
  }
  const encoding = header.getUint8(5) as Encoding;
  if (BYTES[encoding] === undefined) {
    throw new TypeError(`decodePeaks: unsupported encoding ${encoding}.`);
  }
  const headerSize = header.getUint16(6, true);
  const channelCount = header.getUint16(8, true);
  const mask = header.getUint16(10, true);
  const length = header.getUint32(20, true);
  if (headerSize < HEADER_SIZE) {
    throw new TypeError(`decodePeaks: invalid header size ${headerSize}.`);
  }
  if ((mask & ALL_METRICS) !== ALL_METRICS) {
    throw new TypeError('decodePeaks: min, max and rms are required.');
  }

  const bytes = BYTES[encoding];
  let metricsInMask = 0;
  for (let bit = 0; bit < 16; bit++) if (mask & (1 << bit)) metricsInMask++;
  const expected = headerSize + channelCount * metricsInMask * length * bytes;
  if (buffer.byteLength !== expected) {
    throw new TypeError(
      `decodePeaks: expected ${expected} bytes, got ${buffer.byteLength}.`
    );
  }

  let offset = headerSize;
  const channels: PeakChannel[] = [];
  for (let c = 0; c < channelCount; c++) {
    const channel = {} as PeakChannel;
    for (let bit = 0; bit < 16; bit++) {
      if (!(mask & (1 << bit))) continue;
      const metric = METRICS[bit];
      if (metric) {
        channel[metric] = readValues(
          buffer,
          offset,
          length,
          encoding,
          SIGNED[metric]
        );
      } // else: a metric added by a later writer; skip it.
      offset += length * bytes;
    }
    channels.push(channel);
  }

  return {
    sampleRate: header.getUint32(12, true),
    framesPerBucket: header.getUint32(16, true),
    startFrame: header.getFloat64(24, true),
    frameCount: header.getFloat64(32, true),
    length,
    channels,
  };
}
/* eslint-enable no-bitwise */
