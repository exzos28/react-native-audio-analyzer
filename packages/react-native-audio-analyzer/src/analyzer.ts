import { NitroModules } from 'react-native-nitro-modules';
import type {
  AudioAnalyzer,
  NativeAudioSource,
} from './specs/AudioAnalyzer.nitro';
import type { AudioAnalyzerDownloader } from './specs/AudioAnalyzerDownloader.nitro';
import { fromNativePeaks, type Peaks } from './peaks';

// Hybrid objects are created lazily so that importing the package never
// throws (e.g. in Jest or on an unsupported platform) and a problem with one
// native object cannot break the other.
let analyzer: AudioAnalyzer | undefined;
let downloader: AudioAnalyzerDownloader | undefined;

function getAnalyzer(): AudioAnalyzer {
  analyzer ??= NitroModules.createHybridObject<AudioAnalyzer>('AudioAnalyzer');
  return analyzer;
}

function getDownloader(): AudioAnalyzerDownloader {
  downloader ??= NitroModules.createHybridObject<AudioAnalyzerDownloader>(
    'AudioAnalyzerDownloader'
  );
  return downloader;
}

// ── Sources ─────────────────────────────────────────────────────────────────

/**
 * Where to read audio from:
 * - an absolute path or `file://` URI;
 * - an `http(s)://` URL, downloaded and cached with {@link load};
 * - `{ uri, headers }` for a URL that needs request headers;
 * - an `ArrayBuffer` with the bytes of an encoded file (e.g. a recording).
 */
export type AudioSource =
  string | { uri: string; headers?: Record<string, string> } | ArrayBuffer;

const URI_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const FILE_URI = /^file:\/\//i;
// Decides whether a source is remote; load() then validates the URL itself.
const HTTP_URL = /^https?:\/\/./i;

function describe(value: unknown): string {
  return typeof value === 'string' ? `"${value}"` : String(value);
}

/**
 * Converts an absolute path or a `file://` URI into a filesystem path.
 *
 * @throws {TypeError} for empty input, malformed `file://` URIs and any other
 * URI scheme.
 */
export function toFilePath(source: string): string {
  if (typeof source !== 'string' || source.length === 0) {
    throw new TypeError(
      `Expected a non-empty file path or file:// URI, got ${describe(source)}.`
    );
  }

  if (FILE_URI.test(source)) {
    let rest = source.slice('file://'.length);
    if (rest.toLowerCase().startsWith('localhost/')) {
      rest = rest.slice('localhost'.length);
    }
    if (!rest.startsWith('/')) {
      throw new TypeError(
        `Unsupported file URI "${source}": only local absolute file:// URIs are supported.`
      );
    }
    try {
      return decodeURIComponent(rest);
    } catch {
      throw new TypeError(`Malformed file URI "${source}".`);
    }
  }

  if (URI_SCHEME.test(source)) {
    throw new TypeError(
      `Unsupported source "${source}": expected a file path, a file:// URI or an http(s):// URL.`
    );
  }

  return source;
}

function abortError(): Error {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortError();
}

/**
 * Resolves with `promise`, or rejects with an AbortError as soon as `signal`
 * aborts — without waiting for `promise`, which keeps running.
 */
function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined
): Promise<T> {
  if (!signal) return promise;
  throwIfAborted(signal);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}

/** Resolves a source to something the native analyzer can open. */
async function resolveSource(
  source: AudioSource,
  signal: AbortSignal | undefined
): Promise<NativeAudioSource> {
  if (source instanceof ArrayBuffer) {
    if (source.byteLength === 0) {
      throw new TypeError('The audio ArrayBuffer is empty.');
    }
    return source;
  }

  const { uri, headers } =
    typeof source === 'string' ? { uri: source, headers: undefined } : source;
  if (typeof uri === 'string' && HTTP_URL.test(uri)) {
    return abortable(load(uri, { headers }), signal);
  }
  if (headers !== undefined) {
    throw new TypeError('headers are only supported for http(s):// URLs.');
  }
  return toFilePath(uri);
}

// ── Info ────────────────────────────────────────────────────────────────────

export interface AudioInfo {
  /**
   * Detected codec: `'wav'`, `'flac'`, `'mp3'`, `'vorbis'` (built-in), or
   * what the platform decoder reports, e.g. `'aac'`, `'alac'`, `'opus'`,
   * `'aiff'`.
   */
  format: string;
  /**
   * `'builtin'`: decoded by the bundled decoders (identical on iOS and
   * Android). `'platform'`: decoded by the operating system (AudioToolbox on
   * iOS, MediaCodec on Android).
   */
  decoder: 'builtin' | 'platform';
  sampleRate: number;
  /** Number of channels in the file. */
  channelCount: number;
  /** Total number of frames (samples per channel). */
  frames: number;
  /** Duration in seconds. */
  duration: number;
}

/**
 * Reads format, sample rate, channel count and duration without analyzing
 * the samples. Remote sources are downloaded (and cached) first.
 */
export async function getAudioInfo(source: AudioSource): Promise<AudioInfo> {
  const resolved = await resolveSource(source, undefined);
  const info = await getAnalyzer().getInfo(resolved);
  return {
    format: info.format,
    decoder: info.decoder as AudioInfo['decoder'],
    sampleRate: info.sampleRate,
    channelCount: info.channels,
    frames: info.frames,
    duration: info.sampleRate > 0 ? info.frames / info.sampleRate : 0,
  };
}

// ── Analysis ────────────────────────────────────────────────────────────────

export interface AnalyzeOptions {
  /**
   * Upper bound on the number of buckets (per channel). The bucket size is
   * 256 frames (≈ 5.8 ms at 44.1 kHz), raised as needed to stay within this
   * bound. Default 100 000 — enough to zoom deep into an hour of audio. Use a
   * small value (e.g. 1 000) when you only draw a few dozen bars, such as in
   * chat bubbles or lists: it saves memory (12 bytes per bucket and channel).
   */
  maxBuckets?: number;
  /** Exact bucket size in frames. Overrides `maxBuckets`. */
  framesPerBucket?: number;
  /** Keep channels apart instead of aggregating them into one. Default `false`. */
  splitChannels?: boolean;
  /** Start of the analyzed range in seconds. Default 0. */
  start?: number;
  /** End of the analyzed range in seconds (exclusive). Default: end of file. */
  end?: number;
  /**
   * Cancels the analysis; the promise rejects with an `AbortError`. A download
   * in progress is not interrupted: it finishes in the background and is
   * cached for the next call.
   */
  signal?: AbortSignal;
  /** Called with the analyzed fraction (0…1), at most every 1%, ending with 1. */
  onProgress?: (fraction: number) => void;
}

let nextJobId = 1;

const DEFAULT_MAX_BUCKETS = 100_000;

function assertAnalyzeOptions(options: AnalyzeOptions): void {
  const { framesPerBucket, maxBuckets, splitChannels, start, end } = options;
  const positiveInteger = (value: number | undefined) =>
    value === undefined || (Number.isInteger(value) && value > 0);
  if (!positiveInteger(framesPerBucket)) {
    throw new RangeError(
      `framesPerBucket must be a positive integer, got ${framesPerBucket}.`
    );
  }
  if (!positiveInteger(maxBuckets)) {
    throw new RangeError(
      `maxBuckets must be a positive integer, got ${maxBuckets}.`
    );
  }
  if (splitChannels !== undefined && typeof splitChannels !== 'boolean') {
    throw new TypeError(
      `splitChannels must be a boolean, got ${describe(splitChannels)}.`
    );
  }
  if (start !== undefined && !(Number.isFinite(start) && start >= 0)) {
    throw new RangeError(`start must be a number >= 0, got ${start}.`);
  }
  if (end !== undefined && !(Number.isFinite(end) && end >= (start ?? 0))) {
    throw new RangeError(`end must be a number >= start, got ${end}.`);
  }
}

/**
 * Decodes an audio file once, on a background thread and in constant working
 * memory, and returns per-bucket statistics (min, max, RMS) at a fixed
 * resolution. Turn them into bars with {@link resample} as often as needed —
 * changing the bar count, zooming or switching metrics never decodes again.
 *
 * Formats: WAV, FLAC, MP3 and OGG Vorbis everywhere, plus what the platform
 * decodes — AAC/M4A on iOS and Android, ALAC/AIFF/CAF on iOS, Opus on
 * Android.
 *
 * @example
 * const peaks = await analyzeAudio('https://example.com/song.mp3');
 * const bars = normalize(resample(peaks, 64));
 */
export async function analyzeAudio(
  source: AudioSource,
  options: AnalyzeOptions = {}
): Promise<Peaks> {
  assertAnalyzeOptions(options);
  const { signal, onProgress } = options;
  throwIfAborted(signal);
  const resolved = await resolveSource(source, signal);
  // abort() may have been called while the source was being resolved.
  throwIfAborted(signal);

  const native = getAnalyzer();
  const jobId = nextJobId++;
  const onAbort = () => native.cancel(jobId);
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const result = await native.analyze(
      jobId,
      resolved,
      {
        framesPerBucket: options.framesPerBucket ?? 0,
        maxBuckets: options.maxBuckets ?? DEFAULT_MAX_BUCKETS,
        splitChannels: options.splitChannels ?? false,
        startTime: options.start ?? 0,
        endTime: options.end ?? -1,
      },
      onProgress
    );
    // The job may have finished just as abort() was called.
    throwIfAborted(signal);
    return fromNativePeaks(result);
  } catch (error) {
    // Report cancellation the standard way, whatever the native message is.
    throwIfAborted(signal);
    throw error;
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}

// ── Download cache ──────────────────────────────────────────────────────────

export interface LoadOptions {
  /** Request headers, e.g. `Authorization`. They are not part of the cache key. */
  headers?: Record<string, string>;
}

// Concurrent load() calls for the same URL and headers share one download.
const inflight = new Map<string, Promise<string>>();

function requestKey(url: string, headers: Record<string, string>): string {
  const sorted = Object.keys(headers)
    .sort()
    .map((name) => [name.toLowerCase(), headers[name]]);
  return JSON.stringify([url, sorted]);
}

/**
 * Downloads a remote audio file into the app's cache directory and resolves
 * with its absolute filesystem path.
 *
 * Files are cached by URL: repeated calls with the same URL resolve
 * immediately with the cached file, without network access. Concurrent calls
 * for the same URL and headers share one download. Non-2xx responses reject
 * and are never cached. Headers are not forwarded when a redirect leads to
 * another origin.
 *
 * @param url `http://` or `https://` URL.
 */
export function load(url: string, options: LoadOptions = {}): Promise<string> {
  if (typeof url !== 'string' || !HTTP_URL.test(url)) {
    return Promise.reject(
      new TypeError(
        `load() expects an http:// or https:// URL, got ${describe(url)}.`
      )
    );
  }
  if (/\s/.test(url)) {
    return Promise.reject(
      new TypeError(
        `The URL ${JSON.stringify(url)} contains whitespace; encode it first, e.g. with encodeURI().`
      )
    );
  }
  const headers = options.headers ?? {};
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value !== 'string') {
      return Promise.reject(
        new TypeError(`Header "${name}" must be a string.`)
      );
    }
  }
  const key = requestKey(url, headers);
  const running = inflight.get(key);
  if (running) return running;

  const download = (async () => getDownloader().load(url, headers))();
  inflight.set(key, download);
  const forget = () => {
    if (inflight.get(key) === download) inflight.delete(key);
  };
  download.then(forget, forget);
  return download;
}

/** Deletes every file downloaded by {@link load}. */
export async function clearCache(): Promise<void> {
  return getDownloader().clearCache();
}

/** Total size of the files downloaded by {@link load}, in bytes. */
export async function getCacheSize(): Promise<number> {
  return getDownloader().getCacheSize();
}
