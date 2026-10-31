import type { HybridObject } from 'react-native-nitro-modules';

/**
 * A local audio file (absolute filesystem path) or an encoded audio file held
 * in memory.
 */
export type NativeAudioSource = string | ArrayBuffer;

export interface NativeAudioInfo {
  /** Detected codec, e.g. `'mp3'`, `'aac'`, `'vorbis'`. */
  format: string;
  /** `'builtin'` (miniaudio) or `'platform'` (AudioToolbox / MediaCodec). */
  decoder: string;
  sampleRate: number;
  channels: number;
  /** Total number of PCM frames (samples per channel). */
  frames: number;
}

export interface NativeAnalyzeOptions {
  /** Exact frames per bucket; 0 derives it from `maxBuckets`. */
  framesPerBucket: number;
  /** Upper bound on the number of buckets when `framesPerBucket` is 0. */
  maxBuckets: number;
  /** Keep channels separate instead of aggregating them into one. */
  splitChannels: boolean;
  /** Start of the analyzed range in seconds. */
  startTime: number;
  /** End of the analyzed range in seconds (exclusive); -1 means the end of the file. */
  endTime: number;
}

/**
 * Per-bucket statistics. Every buffer holds `length * channels` little-endian
 * Float32 values, channel-major: all buckets of channel 0, then channel 1, …
 */
export interface NativePeaks {
  sampleRate: number;
  /** Number of channels in the buffers (1 when channels were aggregated). */
  channels: number;
  framesPerBucket: number;
  /** First analyzed frame. */
  startFrame: number;
  /** Number of analyzed frames; the last bucket may be partial. */
  frameCount: number;
  /** Buckets per channel. */
  length: number;
  min: ArrayBuffer;
  max: ArrayBuffer;
  rms: ArrayBuffer;
}

/**
 * Native audio analysis, implemented once in C++ (miniaudio) for both
 * platforms. Use the wrappers exported from the package root instead.
 */
export interface AudioAnalyzer extends HybridObject<{
  ios: 'c++';
  android: 'c++';
}> {
  /** Reads format, sample rate, channels and length. */
  getInfo(source: NativeAudioSource): Promise<NativeAudioInfo>;

  /**
   * Decodes `source` once on a background thread and returns per-bucket
   * statistics. `jobId` identifies the job for `cancel()`.
   */
  analyze(
    jobId: number,
    source: NativeAudioSource,
    options: NativeAnalyzeOptions,
    onProgress?: (fraction: number) => void
  ): Promise<NativePeaks>;

  /** Cancels a running `analyze()` job; its promise rejects. No-op if done. */
  cancel(jobId: number): void;
}
