/**
 * Integration test: renders the demo app against the real library code with
 * only the native layer (react-native-nitro-modules) mocked, the way a
 * consumer app would use it. See ../../__mocks__/react-native-nitro-modules.ts.
 */
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { NitroModules } from 'react-native-nitro-modules';

import App, { CHAT_BARS, TRACKS } from '../App';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default
);

const analyzer = NitroModules.createHybridObject(
  'AudioAnalyzer'
) as unknown as { analyze: jest.Mock; cancel: jest.Mock };
const downloader = NitroModules.createHybridObject(
  'AudioAnalyzerDownloader'
) as unknown as { load: jest.Mock };

const mp3 = TRACKS[0]!;

/** What the native module returns: 1000 buckets of a rising ramp. */
function nativePeaks() {
  const length = 1000;
  const ramp = Float32Array.from({ length }, (_, i) => (i + 1) / length);
  return {
    sampleRate: 44100,
    channels: 1,
    framesPerBucket: 256,
    startFrame: 0,
    frameCount: length * 256,
    length,
    min: ramp.map((value) => -value / 2).buffer,
    max: ramp.slice().buffer,
    rms: ramp.map((value) => value * 0.7).buffer,
  };
}

async function render(): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<App />);
  });
  return renderer;
}

async function press(renderer: ReactTestRenderer, testID: string) {
  await act(async () => {
    renderer.root.findByProps({ testID }).props.onPress();
  });
}

function status(renderer: ReactTestRenderer): string {
  return renderer.root.findByProps({ testID: 'status' }).props.children;
}

function hostNodes(renderer: ReactTestRenderer, testID: string) {
  return renderer.root.findAll(
    (node) => node.props.testID === testID && typeof node.type === 'string'
  );
}

beforeEach(() => {
  analyzer.analyze.mockReset();
  analyzer.cancel.mockReset();
  downloader.load.mockReset();
  downloader.load.mockResolvedValue('/cache/song.mp3');
  analyzer.analyze.mockImplementation(async () => nativePeaks());
});

it('starts idle', async () => {
  const renderer = await render();
  expect(status(renderer)).toBe('Pick a track to analyze');
  expect(hostNodes(renderer, 'waveform-bar')).toHaveLength(0);
});

it('draws a chat bubble with the chat preset and a full waveform', async () => {
  const renderer = await render();

  await press(renderer, `track-${mp3.id}`);

  // Both hooks share one download.
  expect(downloader.load).toHaveBeenCalledTimes(1);
  expect(downloader.load).toHaveBeenCalledWith(mp3.url, {});
  const options = analyzer.analyze.mock.calls.map((call) => call[2]);
  expect(options).toContainEqual(
    expect.objectContaining({ maxBuckets: 1_000 })
  );
  expect(options).toContainEqual(
    expect.objectContaining({ maxBuckets: 100_000 })
  );
  expect(status(renderer)).toBe(mp3.title);
  expect(hostNodes(renderer, 'chat-bar')).toHaveLength(CHAT_BARS);
  expect(hostNodes(renderer, 'waveform-bar')).toHaveLength(96);
});

it('turns every knob without decoding again', async () => {
  const renderer = await render();
  await press(renderer, `track-${mp3.id}`);
  const analyses = analyzer.analyze.mock.calls.length;

  for (const knob of [
    'bars-192',
    'metric-peak',
    'metric-minmax',
    'scale-db',
    'reference-p99',
    'zoom-16x',
  ]) {
    await press(renderer, knob);
  }

  expect(hostNodes(renderer, 'waveform-bar')).toHaveLength(192);
  expect(analyzer.analyze).toHaveBeenCalledTimes(analyses);
});

it('shows native decoding errors', async () => {
  analyzer.analyze.mockRejectedValue(
    new Error('Unsupported or corrupted audio file')
  );
  const renderer = await render();

  await press(renderer, 'track-error');

  expect(status(renderer)).toBe('Error: Unsupported or corrupted audio file');
  expect(hostNodes(renderer, 'waveform-bar')).toHaveLength(0);
});

it('cancels running analyses when another track is picked', async () => {
  analyzer.analyze.mockReturnValue(new Promise(() => {}));
  const renderer = await render();
  await press(renderer, `track-${mp3.id}`);
  const firstJobs = analyzer.analyze.mock.calls.map((call) => call[0]);

  analyzer.analyze.mockImplementation(async () => nativePeaks());
  await press(renderer, 'track-wav');

  for (const job of firstJobs) {
    expect(analyzer.cancel).toHaveBeenCalledWith(job);
  }
  expect(status(renderer)).toBe(TRACKS[1]!.title);
});
