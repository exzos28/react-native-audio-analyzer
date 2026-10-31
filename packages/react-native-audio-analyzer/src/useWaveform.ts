import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzeAudio,
  type AnalyzeOptions,
  type AudioSource,
} from './analyzer';
import {
  normalize as normalizeValues,
  peaksLevel,
  resample,
  type Metric,
  type NormalizeOptions,
  type RangeOptions,
} from './display';
import type { Peaks } from './peaks';

/** How `useWaveform` scales `bars`. */
export interface WaveformNormalizeOptions extends NormalizeOptions {
  /**
   * Percentile of the bucket levels used as the reference when `reference`
   * is not given (see {@link peaksLevel}). The reference is taken over the
   * whole analyzed range, so zooming or changing `barCount` never rescales
   * the waveform. Default 1 (the loudest bucket).
   */
  percentile?: number;
}

export interface UseWaveformOptions {
  /**
   * Number of values in `bars`. Fractional values are rounded down, so
   * `width / barSlot` can be passed as is. Leave undefined to only get `peaks`.
   */
  barCount?: number;
  /** Metric of `bars`. Default `'rms'`. */
  metric?: Metric;
  /** Scaling of `bars`, or `false` for raw levels (0…1 of full scale). Default `{ scale: 'linear' }`. */
  normalize?: WaveformNormalizeOptions | false;
  /** Time range and channel shown in `bars`. Changing it never decodes again. */
  view?: RangeOptions;
  /** Analysis options. Changing them runs a new analysis. */
  analysis?: Omit<AnalyzeOptions, 'signal' | 'onProgress'>;
  /** Set to `false` to skip analysis (e.g. while the source is not known yet). Default `true`. */
  enabled?: boolean;
}

/**
 * Ready-made option sets. They are plain objects: spread one and override
 * whatever you like.
 *
 * @example
 * useWaveform(url, { ...waveformPresets.chat, barCount: 40 });
 */
export const waveformPresets = {
  /**
   * Voice messages and other short clips drawn with a few dozen bars.
   * Analyzes at low resolution (fast, ~12 KB of peaks), uses loudness (RMS)
   * so speech keeps its shape, and ignores the loudest 1% of buckets so a
   * single plosive doesn't flatten the rest.
   */
  chat: {
    analysis: { maxBuckets: 1_000 },
    metric: 'rms',
    normalize: { scale: 'linear', percentile: 0.99 },
  },
  /** Track overviews and scrubbers: moderate resolution, loudness-based. */
  player: {
    analysis: { maxBuckets: 10_000 },
    metric: 'rms',
    normalize: { scale: 'linear', percentile: 0.995 },
  },
  /** Precise views with deep zoom: full resolution, sample peaks, no clipping. */
  editor: {
    analysis: { maxBuckets: 100_000 },
    metric: 'peak',
    normalize: { scale: 'linear', percentile: 1 },
  },
} satisfies Record<string, UseWaveformOptions>;

export type WaveformStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface WaveformState {
  status: WaveformStatus;
  /** Analysis result; `null` until ready. */
  peaks: Peaks | null;
  /** `barCount` values ready to draw (0…1 when normalized); `null` until ready or without `barCount`. */
  bars: number[] | null;
  /** Analysis or display error; `status` is `'error'` when set. */
  error: Error | null;
  /** Analysis progress, 0…1. */
  progress: number;
  /** Runs the analysis again. */
  reload: () => void;
}

// Stable identity for ArrayBuffer sources, which cannot be compared by value.
const bufferIds = new WeakMap<ArrayBuffer, number>();
let nextBufferId = 1;

function sourceKey(source: AudioSource | null | undefined): string | null {
  if (source == null) return null;
  if (typeof source === 'string') return `s:${source}`;
  if (source instanceof ArrayBuffer) {
    let id = bufferIds.get(source);
    if (id === undefined) {
      id = nextBufferId++;
      bufferIds.set(source, id);
    }
    return `b:${id}`;
  }
  return `u:${JSON.stringify([source.uri, source.headers ?? null])}`;
}

/**
 * Value-based key for option objects, so an inline `{ start: 1 }` on every
 * render does not invalidate memos. Unlike plain JSON it tells NaN, ±Infinity
 * and undefined apart from null.
 */
function optionsKey(value: unknown): string {
  return (
    JSON.stringify(value, (_, item: unknown) =>
      typeof item === 'number' && !Number.isFinite(item)
        ? `__number:${item}`
        : item === undefined
          ? '__undefined'
          : item
    ) ?? '__undefined'
  );
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

interface AnalysisState {
  /** Which analysis run this state belongs to. */
  run: string;
  status: 'loading' | 'ready' | 'error';
  peaks: Peaks | null;
  error: Error | null;
  progress: number;
}

/**
 * Analyzes `source` and keeps the result. The analysis runs once per source
 * and `analysis` options; `barCount`, `metric`, `normalize` and `view` only
 * resample the stored peaks. A running analysis is cancelled when the source
 * changes or the component unmounts, and results of a previous source are
 * never returned for a new one.
 *
 * @example
 * const { bars } = useWaveform(url, { ...waveformPresets.chat, barCount: 40 });
 */
export function useWaveform(
  source: AudioSource | null | undefined,
  options: UseWaveformOptions = {}
): WaveformState {
  const {
    barCount,
    metric = 'rms',
    normalize = { scale: 'linear' },
    view,
    analysis,
    enabled = true,
  } = options;

  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const key = sourceKey(source);
  const active = enabled && key !== null;
  const run = active ? optionsKey([key, analysis ?? null, reloadToken]) : null;

  const [state, setState] = useState<AnalysisState | null>(null);
  // The latest source object, read by the effect; the effect itself re-runs
  // only when `run` changes.
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const analysisRef = useRef(analysis);
  analysisRef.current = analysis;

  useEffect(() => {
    if (run === null || sourceRef.current == null) return;
    const controller = new AbortController();
    const update = (next: Omit<AnalysisState, 'run'>) => {
      if (!controller.signal.aborted) setState({ run, ...next });
    };
    update({ status: 'loading', peaks: null, error: null, progress: 0 });
    analyzeAudio(sourceRef.current, {
      ...analysisRef.current,
      signal: controller.signal,
      onProgress: (progress) =>
        update({ status: 'loading', peaks: null, error: null, progress }),
    }).then(
      (peaks) => update({ status: 'ready', peaks, error: null, progress: 1 }),
      (error: unknown) =>
        update({
          status: 'error',
          peaks: null,
          error: toError(error),
          progress: 0,
        })
    );
    return () => controller.abort();
  }, [run]);

  // Never expose a previous run's result, even for the render before the
  // effect of a new run has started.
  const current = state !== null && state.run === run ? state : null;
  const peaks = current?.peaks ?? null;

  // The memo re-runs when these keys change; the options themselves are read
  // from refs, untouched, so invalid values (NaN, Infinity) still reach
  // resample/normalize and are reported instead of being coerced by JSON.
  const viewKey = optionsKey(view);
  const normalizeKey = optionsKey(normalize);
  const viewRef = useRef(view);
  viewRef.current = view;
  const normalizeRef = useRef(normalize);
  normalizeRef.current = normalize;

  // The automatic reference covers the whole file, so zooming, panning or a
  // new bar count must not recompute it (with a percentile it sorts every
  // bucket). It only depends on these primitives.
  const autoReferenceNeeded =
    normalize !== false && normalize.reference === undefined;
  const percentile = normalize === false ? undefined : normalize.percentile;
  const channel = view?.channel;
  const autoReference = useMemo(():
    | { value: number; error?: undefined }
    | { value?: undefined; error: Error }
    | null => {
    if (!peaks || !autoReferenceNeeded) return null;
    try {
      return { value: peaksLevel(peaks, { metric, percentile, channel }) };
    } catch (cause) {
      return { error: toError(cause) };
    }
  }, [peaks, autoReferenceNeeded, metric, percentile, channel]);

  const display = useMemo((): {
    bars: number[] | null;
    error: Error | null;
  } => {
    if (!peaks || barCount === undefined) return { bars: null, error: null };
    try {
      const range: RangeOptions | undefined = viewRef.current;
      const values = resample(peaks, Math.max(0, Math.floor(barCount)), {
        ...range,
        metric,
      });
      const scaling: WaveformNormalizeOptions | false = normalizeRef.current;
      if (scaling === false) return { bars: Array.from(values), error: null };
      let reference = scaling.reference;
      if (reference === undefined) {
        if (autoReference?.error) throw autoReference.error;
        reference = autoReference?.value;
      }
      const { scale, floorDb } = scaling;
      return {
        bars: Array.from(
          normalizeValues(values, { scale, floorDb, reference })
        ),
        error: null,
      };
    } catch (cause) {
      return { bars: null, error: toError(cause) };
    }
    // viewKey/normalizeKey stand in for the option objects read from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peaks, barCount, metric, viewKey, normalizeKey, autoReference]);

  let status: WaveformStatus = 'idle';
  let error: Error | null = null;
  if (active) {
    status = current?.status ?? 'loading';
    error = current?.error ?? null;
    if (status === 'ready' && display.error) {
      status = 'error';
      error = display.error;
    }
  }

  return {
    status,
    peaks: status === 'ready' ? peaks : null,
    bars: status === 'ready' ? display.bars : null,
    error,
    progress: current?.progress ?? 0,
    reload,
  };
}
