import { makePeaks, toNative } from './fixtures';

const mockNative = {
  getInfo: jest.fn(),
  analyze: jest.fn(),
  cancel: jest.fn(),
  load: jest.fn(),
  clearCache: jest.fn(),
  getCacheSize: jest.fn(),
};
const mockCreateHybridObject = jest.fn((_name: string) => mockNative);

// jest.mock() is hoisted above the declarations, so only reach the mocks
// lazily, from inside the function.
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: (name: string) => mockCreateHybridObject(name),
  },
}));

import {
  analyzeAudio,
  clearCache,
  getAudioInfo,
  getCacheSize,
  load,
  toFilePath,
} from '../analyzer';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  Object.values(mockNative).forEach((fn) => fn.mockReset());
  mockNative.analyze.mockResolvedValue(toNative(makePeaks(4)));
  mockNative.load.mockResolvedValue('/cache/song.mp3');
});

describe('module initialization', () => {
  it('does not create native objects on import', () => {
    expect(mockCreateHybridObject).not.toHaveBeenCalled();
  });

  it('creates each native object once, on first use', async () => {
    await analyzeAudio('/a.mp3');
    await analyzeAudio('/b.mp3');
    await load('https://example.com/a.mp3');
    await load('https://example.com/b.mp3');
    expect(mockCreateHybridObject.mock.calls).toEqual([
      ['AudioAnalyzer'],
      ['AudioAnalyzerDownloader'],
    ]);
  });
});

describe('toFilePath', () => {
  it.each([
    ['/data/user/0/app/cache/a.mp3', '/data/user/0/app/cache/a.mp3'],
    ['file:///var/mobile/a.mp3', '/var/mobile/a.mp3'],
    ['FILE:///var/mobile/a.mp3', '/var/mobile/a.mp3'],
    ['file://localhost/var/mobile/a.mp3', '/var/mobile/a.mp3'],
    [
      'file:///var/My%20Music/%D0%BF%D0%B5%D1%81%D0%BD%D1%8F.mp3',
      '/var/My Music/песня.mp3',
    ],
    ['relative/path.mp3', 'relative/path.mp3'],
  ])('converts %s', (input, expected) => {
    expect(toFilePath(input)).toBe(expected);
  });

  it.each([
    ['content://media/external/audio/1', /Unsupported source/],
    ['file://server/share/a.mp3', /only local absolute file:\/\/ URIs/],
    ['file:///broken%E0%A4%A.mp3', /Malformed file URI/],
    ['', /non-empty/],
  ])('rejects %s', (input, message) => {
    expect(() => toFilePath(input)).toThrow(message);
  });
});

describe('analyzeAudio', () => {
  it('passes a local path and default options to native', async () => {
    const peaks = await analyzeAudio('file:///tmp/My%20Song.mp3');
    expect(mockNative.analyze).toHaveBeenCalledWith(
      expect.any(Number),
      '/tmp/My Song.mp3',
      {
        framesPerBucket: 0,
        maxBuckets: 100_000,
        splitChannels: false,
        startTime: 0,
        endTime: -1,
      },
      undefined
    );
    expect(peaks.length).toBe(4);
    expect(peaks.channels[0]!.max).toBeInstanceOf(Float32Array);
  });

  it('maps options', async () => {
    const onProgress = jest.fn();
    await analyzeAudio('/a.wav', {
      framesPerBucket: 512,
      maxBuckets: 50,
      splitChannels: true,
      start: 1.5,
      end: 3,
      onProgress,
    });
    expect(mockNative.analyze).toHaveBeenCalledWith(
      expect.any(Number),
      '/a.wav',
      {
        framesPerBucket: 512,
        maxBuckets: 50,
        splitChannels: true,
        startTime: 1.5,
        endTime: 3,
      },
      onProgress
    );
  });

  it('downloads remote sources first, with headers', async () => {
    await analyzeAudio({
      uri: 'https://example.com/a.mp3',
      headers: { Authorization: 'Bearer x' },
    });
    expect(mockNative.load).toHaveBeenCalledWith('https://example.com/a.mp3', {
      Authorization: 'Bearer x',
    });
    expect(mockNative.analyze.mock.calls[0][1]).toBe('/cache/song.mp3');
  });

  it('passes ArrayBuffer sources through', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    await analyzeAudio(bytes);
    expect(mockNative.analyze.mock.calls[0][1]).toBe(bytes);
  });

  it.each([
    [{ framesPerBucket: 0 }],
    [{ framesPerBucket: 1.5 }],
    [{ maxBuckets: 0 }],
    [{ start: -1 }],
    [{ start: 2, end: 1 }],
  ])('rejects invalid options %p without calling native', async (options) => {
    await expect(analyzeAudio('/a.mp3', options)).rejects.toThrow(RangeError);
    expect(mockNative.analyze).not.toHaveBeenCalled();
  });

  it('rejects a non-boolean splitChannels', async () => {
    await expect(
      analyzeAudio('/a.mp3', { splitChannels: 'yes' as never })
    ).rejects.toThrow(TypeError);
  });

  it.each(['', 'content://media/1'])('rejects source %p', async (source) => {
    await expect(analyzeAudio(source)).rejects.toThrow(TypeError);
  });

  it('rejects headers for local files and empty buffers', async () => {
    await expect(
      analyzeAudio({ uri: '/a.mp3', headers: { A: 'b' } })
    ).rejects.toThrow(/only supported for http/);
    await expect(analyzeAudio(new ArrayBuffer(0))).rejects.toThrow(/empty/);
  });

  it('honours abort() called synchronously after the call', async () => {
    const controller = new AbortController();
    const result = analyzeAudio('/a.mp3', { signal: controller.signal });
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockNative.analyze).not.toHaveBeenCalled();
  });

  it('cancels the native job when the signal aborts during analysis', async () => {
    const job = deferred<ReturnType<typeof toNative>>();
    mockNative.analyze.mockReturnValue(job.promise);
    const controller = new AbortController();
    const result = analyzeAudio('/a.mp3', { signal: controller.signal });
    await new Promise<void>((resolve) => setImmediate(resolve));

    controller.abort();
    expect(mockNative.cancel).toHaveBeenCalledWith(
      mockNative.analyze.mock.calls[0][0]
    );
    job.reject(new Error('Analysis was cancelled'));
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects promptly when aborted during a download', async () => {
    const download = deferred<string>();
    mockNative.load.mockReturnValue(download.promise);
    const controller = new AbortController();
    const result = analyzeAudio('https://example.com/a.mp3', {
      signal: controller.signal,
    });
    await new Promise<void>((resolve) => setImmediate(resolve));

    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockNative.analyze).not.toHaveBeenCalled();
    download.resolve('/cache/a.mp3'); // finishes in the background
  });

  it('reports abort even if the job finished at the same time', async () => {
    const controller = new AbortController();
    mockNative.analyze.mockImplementation(async () => {
      controller.abort();
      return toNative(makePeaks(4));
    });
    await expect(
      analyzeAudio('/a.mp3', { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('uses a new job id for every call', async () => {
    await analyzeAudio('/a.mp3');
    await analyzeAudio('/a.mp3');
    expect(mockNative.analyze.mock.calls[0][0]).not.toBe(
      mockNative.analyze.mock.calls[1][0]
    );
  });

  it('propagates native errors', async () => {
    mockNative.analyze.mockRejectedValue(new Error('Unsupported format'));
    await expect(analyzeAudio('/a.m4a')).rejects.toThrow('Unsupported format');
  });
});

describe('getAudioInfo', () => {
  it('adds the duration', async () => {
    mockNative.getInfo.mockResolvedValue({
      format: 'mp3',
      decoder: 'builtin',
      sampleRate: 44100,
      channels: 2,
      frames: 88200,
    });
    await expect(getAudioInfo('/a.mp3')).resolves.toEqual({
      format: 'mp3',
      decoder: 'builtin',
      sampleRate: 44100,
      channelCount: 2,
      frames: 88200,
      duration: 2,
    });
  });
});

describe('load and cache', () => {
  it('forwards URL and headers', async () => {
    await expect(load('https://example.com/a.mp3?token=1')).resolves.toBe(
      '/cache/song.mp3'
    );
    expect(mockNative.load).toHaveBeenCalledWith(
      'https://example.com/a.mp3?token=1',
      {}
    );
  });

  it('shares one download between concurrent calls for the same URL', async () => {
    const download = deferred<string>();
    mockNative.load.mockReturnValue(download.promise);
    const first = load('https://example.com/a.mp3');
    const second = load('https://example.com/a.mp3');
    download.resolve('/cache/a.mp3');
    await expect(Promise.all([first, second])).resolves.toEqual([
      '/cache/a.mp3',
      '/cache/a.mp3',
    ]);
    expect(mockNative.load).toHaveBeenCalledTimes(1);

    // Once settled, a new call asks native again (it answers from its cache).
    mockNative.load.mockResolvedValue('/cache/a.mp3');
    await load('https://example.com/a.mp3');
    expect(mockNative.load).toHaveBeenCalledTimes(2);
  });

  it('rejects URLs with whitespace with a hint to encode them', async () => {
    await expect(
      analyzeAudio('https://cdn.example.com/my song.mp3')
    ).rejects.toThrow(/contains whitespace; encode it first/);
    expect(mockNative.load).not.toHaveBeenCalled();
  });

  it('does not share a download between calls with different headers', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    mockNative.load
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const anonymous = load('https://example.com/a.mp3');
    const authorized = load('https://example.com/a.mp3', {
      headers: { Authorization: 'Bearer x' },
    });
    expect(mockNative.load).toHaveBeenCalledTimes(2);
    first.reject(new Error('HTTP 401'));
    second.resolve('/cache/a.mp3');
    await expect(anonymous).rejects.toThrow('HTTP 401');
    await expect(authorized).resolves.toBe('/cache/a.mp3');
  });

  it('shares a download when headers only differ in order or case', async () => {
    const download = deferred<string>();
    mockNative.load.mockReturnValue(download.promise);
    load('https://example.com/a.mp3', { headers: { A: '1', B: '2' } });
    load('https://example.com/a.mp3', { headers: { b: '2', a: '1' } });
    expect(mockNative.load).toHaveBeenCalledTimes(1);
    download.resolve('/cache/a.mp3');
  });

  it('does not keep failed downloads around', async () => {
    mockNative.load.mockRejectedValueOnce(new Error('HTTP 500'));
    await expect(load('https://example.com/b.mp3')).rejects.toThrow('HTTP 500');
    await expect(load('https://example.com/b.mp3')).resolves.toBe(
      '/cache/song.mp3'
    );
  });

  it.each(['', 'ftp://example.com/a.mp3', '/local/a.mp3', 'https://'])(
    'rejects %p without calling native',
    async (url) => {
      await expect(load(url)).rejects.toThrow(TypeError);
      expect(mockNative.load).not.toHaveBeenCalled();
    }
  );

  it('rejects non-string header values', async () => {
    await expect(
      load('https://example.com/a.mp3', { headers: { A: 1 as never } })
    ).rejects.toThrow(/must be a string/);
  });

  it('clears and measures the cache', async () => {
    mockNative.clearCache.mockResolvedValue(undefined);
    mockNative.getCacheSize.mockResolvedValue(1234);
    await clearCache();
    await expect(getCacheSize()).resolves.toBe(1234);
    expect(mockNative.clearCache).toHaveBeenCalled();
  });
});
