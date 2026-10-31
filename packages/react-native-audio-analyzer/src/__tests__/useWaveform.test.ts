import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { makePeaks, toNative } from './fixtures';
import type { WaveformState } from '../useWaveform';

const mockNative = {
  analyze: jest.fn(),
  cancel: jest.fn(),
  load: jest.fn(),
};

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: { createHybridObject: () => mockNative },
}));

import {
  useWaveform,
  waveformPresets,
  type UseWaveformOptions,
} from '../useWaveform';
import type { AudioSource } from '../analyzer';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** Every state the hook returned, in render order. */
let renders: WaveformState[] = [];
const latest = () => renders[renders.length - 1]!;

function Probe(props: {
  source: AudioSource | null;
  options?: UseWaveformOptions;
}) {
  renders.push(useWaveform(props.source, props.options));
  return null;
}

async function render(
  source: AudioSource | null,
  options?: UseWaveformOptions
): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(createElement(Probe, { source, options }));
  });
  return renderer;
}

async function update(
  renderer: ReactTestRenderer,
  source: AudioSource | null,
  options?: UseWaveformOptions
) {
  await act(async () => {
    renderer.update(createElement(Probe, { source, options }));
  });
}

beforeEach(() => {
  renders = [];
  Object.values(mockNative).forEach((fn) => fn.mockReset());
  mockNative.analyze.mockResolvedValue(toNative(makePeaks(100, { seed: 2 })));
});

it('stays idle without a source or when disabled', async () => {
  await render(null);
  expect(latest().status).toBe('idle');
  await render('/a.mp3', { enabled: false });
  expect(latest().status).toBe('idle');
  expect(mockNative.analyze).not.toHaveBeenCalled();
});

it('reports loading from the very first render', async () => {
  mockNative.analyze.mockReturnValue(new Promise(() => {}));
  await render('/a.mp3');
  expect(renders[0]!.status).toBe('loading');
});

it('analyzes once and exposes normalized bars as a plain array', async () => {
  await render('/a.mp3', { barCount: 10 });
  expect(latest().status).toBe('ready');
  expect(latest().peaks?.length).toBe(100);
  expect(Array.isArray(latest().bars)).toBe(true);
  expect(latest().bars).toHaveLength(10);
  expect(Math.max(...latest().bars!)).toBeLessThanOrEqual(1);
  expect(latest().progress).toBe(1);
});

it('floors fractional bar counts', async () => {
  await render('/a.mp3', { barCount: 10.7 });
  expect(latest().bars).toHaveLength(10);
});

it('changing display options does not analyze again', async () => {
  const renderer = await render('/a.mp3', { barCount: 10 });
  await update(renderer, '/a.mp3', { barCount: 20, metric: 'peak' });
  await update(renderer, '/a.mp3', {
    barCount: 20,
    metric: 'peak',
    view: { start: 0, end: 0.1 },
    normalize: false,
  });
  expect(latest().bars).toHaveLength(20);
  expect(mockNative.analyze).toHaveBeenCalledTimes(1);
});

it('changing analysis options analyzes again', async () => {
  const renderer = await render('/a.mp3', { analysis: { maxBuckets: 10 } });
  await update(renderer, '/a.mp3', { analysis: { maxBuckets: 20 } });
  expect(mockNative.analyze).toHaveBeenCalledTimes(2);
  expect(mockNative.analyze.mock.calls[1][2]).toMatchObject({ maxBuckets: 20 });
});

it('keeps the scale when zooming (reference over the whole file)', async () => {
  const renderer = await render('/a.mp3', { barCount: 100, metric: 'peak' });
  const whole = latest().bars!;
  const peaks = latest().peaks!;
  // One bar showing exactly bucket 10.
  const start = (10 * peaks.framesPerBucket) / peaks.sampleRate;
  const end = (11 * peaks.framesPerBucket) / peaks.sampleRate;
  await update(renderer, '/a.mp3', {
    barCount: 1,
    metric: 'peak',
    view: { start, end },
  });
  expect(latest().bars![0]).toBeCloseTo(whole[10]!, 5);
});

it('never returns the previous source’s result for a new source', async () => {
  const renderer = await render('/a.mp3', { barCount: 10 });
  expect(latest().status).toBe('ready');
  mockNative.analyze.mockReturnValue(new Promise(() => {}));
  renders = [];
  await update(renderer, '/b.mp3', { barCount: 10 });
  for (const state of renders) {
    expect(state.status).toBe('loading');
    expect(state.peaks).toBeNull();
    expect(state.bars).toBeNull();
  }
});

it('cancels the previous job when the source changes', async () => {
  mockNative.analyze.mockReturnValueOnce(new Promise(() => {}));
  const renderer = await render('/a.mp3');
  const firstJob = mockNative.analyze.mock.calls[0][0];
  await update(renderer, '/b.mp3');
  expect(mockNative.cancel).toHaveBeenCalledWith(firstJob);
  expect(latest().status).toBe('ready');
});

it('treats equal source objects as the same source', async () => {
  const renderer = await render({ uri: '/a.mp3' });
  await update(renderer, { uri: '/a.mp3' });
  expect(mockNative.analyze).toHaveBeenCalledTimes(1);
});

it('reports analysis errors', async () => {
  mockNative.analyze.mockRejectedValue(new Error('Unsupported format'));
  await render('/a.m4a', { barCount: 10 });
  expect(latest().status).toBe('error');
  expect(latest().error?.message).toBe('Unsupported format');
  expect(latest().bars).toBeNull();
});

it('reports display errors instead of throwing during render', async () => {
  await render('/a.mp3', { barCount: 10, view: { channel: 5 } });
  expect(latest().status).toBe('error');
  expect(latest().error).toBeInstanceOf(RangeError);
});

it.each([
  ['view.start: NaN', { view: { start: NaN } }],
  ['normalize.reference: NaN', { normalize: { reference: NaN } }],
  [
    'normalize.floorDb: -Infinity',
    { normalize: { scale: 'db' as const, floorDb: -Infinity } },
  ],
])(
  'reports invalid display options (%s) instead of coercing them',
  async (_, options) => {
    await render('/a.mp3', { barCount: 10, ...options });
    expect(latest().status).toBe('error');
    expect(latest().error).toBeInstanceOf(RangeError);
  }
);

it('does not recompute bars for a new but equal options object', async () => {
  const renderer = await render('/a.mp3', { barCount: 10, view: { end: 0.1 } });
  const bars = latest().bars;
  await update(renderer, '/a.mp3', { barCount: 10, view: { end: 0.1 } });
  expect(latest().bars).toBe(bars);
});

it('does not recompute the automatic reference when only the view changes', async () => {
  const sort = jest.spyOn(Float32Array.prototype, 'sort');
  const renderer = await render('/a.mp3', {
    barCount: 10,
    normalize: { percentile: 0.99 },
    view: { end: 0.1 },
  });
  const sorts = sort.mock.calls.length;
  expect(sorts).toBeGreaterThan(0);
  await update(renderer, '/a.mp3', {
    barCount: 20,
    normalize: { percentile: 0.99 },
    view: { start: 0.05, end: 0.2 },
  });
  expect(latest().bars).toHaveLength(20);
  expect(sort.mock.calls.length).toBe(sorts);
  sort.mockRestore();
});

it('reload() runs the analysis again', async () => {
  await render('/a.mp3');
  await act(async () => latest().reload());
  expect(mockNative.analyze).toHaveBeenCalledTimes(2);
});

it('cancels the running job on unmount', async () => {
  mockNative.analyze.mockReturnValue(new Promise(() => {}));
  const renderer = await render('/a.mp3');
  await act(async () => renderer.unmount());
  expect(mockNative.cancel).toHaveBeenCalled();
});

it('presets are plain option objects that can be spread and overridden', async () => {
  await render('/a.mp3', { ...waveformPresets.chat, barCount: 40 });
  expect(mockNative.analyze.mock.calls[0][2]).toMatchObject({
    maxBuckets: 1_000,
  });
  expect(latest().bars).toHaveLength(40);
});
