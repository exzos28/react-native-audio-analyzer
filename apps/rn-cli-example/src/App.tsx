// Demo screen for react-native-audio-analyzer.
//
// apps/rn-cli-example/src/App.tsx and apps/expo-example/src/App.tsx are kept
// identical except for the RUNTIME label, so each example stays a
// self-contained, copy-pasteable consumer of the library.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  normalize,
  normalizeMinMax,
  peaksDuration,
  peaksLevel,
  resample,
  resampleMinMax,
  useWaveform,
  waveformPresets,
} from 'react-native-audio-analyzer';

const RUNTIME = 'React Native CLI';

export type Track = {
  id: string;
  title: string;
  detail: string;
  url: string;
};

export const TRACKS: Track[] = [
  {
    id: 'mp3',
    title: 'MP3 · 6 min song',
    detail: 'SoundHelix, ~9 MB — streamed, never fully in memory',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    id: 'wav',
    title: 'WAV · 15 s',
    detail: 'samplelib.com',
    url: 'https://download.samplelib.com/wav/sample-15s.wav',
  },
  {
    id: 'flac',
    title: 'FLAC · stereo',
    detail: 'miniaudio test data',
    url: 'https://raw.githubusercontent.com/mackron/miniaudio/0.11.25/data/16-44100-stereo.flac',
  },
  {
    id: 'ogg',
    title: 'OGG Vorbis · stereo',
    detail: 'miniaudio test data — built-in decoder',
    url: 'https://raw.githubusercontent.com/mackron/miniaudio/0.11.25/data/48000-stereo.ogg',
  },
  {
    id: 'm4a',
    title: 'M4A · AAC',
    detail:
      'filesamples.com — decoded by the platform (AudioToolbox / MediaCodec)',
    url: 'https://filesamples.com/samples/audio/m4a/sample1.m4a',
  },
  {
    id: 'error',
    title: 'Not audio · error',
    detail: 'A text file: shows how decoding errors are reported',
    url: 'https://raw.githubusercontent.com/mackron/miniaudio/0.11.25/README.md',
  },
];

export const CHAT_BARS = 40;
const BAR_COUNTS = ['48', '96', '192'] as const;
const METRICS = ['rms', 'peak', 'minmax'] as const;
const SCALES = ['linear', 'db'] as const;
const REFERENCES = ['max', 'p99'] as const;
const ZOOMS = ['1x', '4x', '16x'] as const;

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <Demo />
    </SafeAreaProvider>
  );
}

function Demo() {
  const insets = useSafeAreaInsets();
  const [track, setTrack] = useState<Track | null>(null);
  const [bars, setBars] = useState<(typeof BAR_COUNTS)[number]>('96');
  const [metric, setMetric] = useState<(typeof METRICS)[number]>('rms');
  const [scale, setScale] = useState<(typeof SCALES)[number]>('linear');
  const [reference, setReference] =
    useState<(typeof REFERENCES)[number]>('max');
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>('1x');

  // 1. A chat bubble: the `chat` preset analyzes at low resolution and
  //    returns ready-to-draw bars.
  const chat = useWaveform(track?.url, {
    ...waveformPresets.chat,
    barCount: CHAT_BARS,
  });

  // 2. A full waveform with every knob exposed: analyze once at full
  //    resolution, then resample in JS whenever a knob changes.
  const full = useWaveform(track?.url);
  const loadMs = useElapsedWhileLoading(full.status);
  const { peaks } = full;

  const view = useMemo(() => {
    if (!peaks) return null;
    const end = peaksDuration(peaks) / parseInt(zoom, 10);
    const count = Number(bars);
    const level = peaksLevel(peaks, {
      metric: metric === 'rms' ? 'rms' : 'peak',
      percentile: reference === 'p99' ? 0.99 : 1,
    });
    const options = { scale, reference: level };
    if (metric === 'minmax') {
      return normalizeMinMax(resampleMinMax(peaks, count, { end }), options);
    }
    return normalize(resample(peaks, count, { end, metric }), options);
  }, [peaks, bars, metric, scale, reference, zoom]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Text style={styles.title}>Audio Analyzer</Text>
      <Text style={styles.subtitle}>
        react-native-audio-analyzer · {RUNTIME}
      </Text>

      <Section title="Track">
        {TRACKS.map((item) => (
          <Pressable
            key={item.id}
            testID={`track-${item.id}`}
            accessibilityRole="button"
            onPress={() => setTrack(item)}
            style={({ pressed }) => [
              styles.track,
              item.id === track?.id && styles.trackActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.trackTitle}>{item.title}</Text>
            <Text style={styles.trackDetail}>{item.detail}</Text>
          </Pressable>
        ))}
      </Section>

      <Section title="Chat preset · 40 bars">
        <View style={styles.bubble}>
          <View style={styles.play}>
            <View style={styles.playIcon} />
          </View>
          <View style={styles.bubbleWave} testID="chat-bubble">
            {(chat.bars ?? new Array<number>(CHAT_BARS).fill(0)).map(
              (value, index) => (
                <View
                  key={index}
                  testID="chat-bar"
                  style={[
                    styles.chatBar,
                    { height: Math.max(3, value * BUBBLE_HEIGHT) },
                  ]}
                />
              )
            )}
          </View>
        </View>
      </Section>

      <Section title="Full waveform · every knob (no re-decoding)">
        <Chips
          options={BAR_COUNTS}
          selected={bars}
          onSelect={setBars}
          testIDPrefix="bars"
        />
        <Chips
          options={METRICS}
          selected={metric}
          onSelect={setMetric}
          testIDPrefix="metric"
        />
        <Chips
          options={SCALES}
          selected={scale}
          onSelect={setScale}
          testIDPrefix="scale"
        />
        <Chips
          options={REFERENCES}
          selected={reference}
          onSelect={setReference}
          testIDPrefix="reference"
        />
        <Chips
          options={ZOOMS}
          selected={zoom}
          onSelect={setZoom}
          testIDPrefix="zoom"
        />
      </Section>

      <View style={styles.result}>
        <Text testID="status" style={styles.status}>
          {describe(track, full.status, full.error)}
        </Text>
        {full.status === 'loading' && (
          <View style={styles.progressTrack}>
            <View
              testID="progress"
              style={[
                styles.progressFill,
                { width: `${Math.round(full.progress * 100)}%` },
              ]}
            />
          </View>
        )}
        {peaks && view && (
          <>
            <Waveform data={view} />
            <Text style={styles.stats}>
              {peaksDuration(peaks).toFixed(1)} s · {peaks.sampleRate} Hz ·{' '}
              {peaks.length} buckets of {peaks.framesPerBucket} frames
              {loadMs !== null ? ` · loaded in ${loadMs} ms` : ''}
            </Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function describe(
  track: Track | null,
  status: string,
  error: Error | null
): string {
  if (!track) return 'Pick a track to analyze';
  if (status === 'loading') return `Analyzing ${track.title}…`;
  if (status === 'error') return `Error: ${error?.message}`;
  return track.title;
}

/** Wall time of the latest loading phase (download + decoding), in ms. */
function useElapsedWhileLoading(status: string): number | null {
  const startedAt = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  useEffect(() => {
    if (status === 'loading') {
      startedAt.current = Date.now();
      setElapsed(null);
    } else if (status === 'ready' && startedAt.current !== null) {
      setElapsed(Date.now() - startedAt.current);
      startedAt.current = null;
    }
  }, [status]);
  return elapsed;
}

type WaveformData = Float32Array | { min: Float32Array; max: Float32Array };

function Waveform({ data }: { data: WaveformData }) {
  const top = data instanceof Float32Array ? data : data.max;
  const bottom = data instanceof Float32Array ? null : data.min;
  const half = WAVEFORM_HEIGHT / 2;
  return (
    <View style={styles.waveform} accessibilityLabel="Waveform">
      {Array.from(top, (value, index) => {
        // Mirrored bars for levels; asymmetric bars for a signed envelope.
        const up = Math.max(1, value * half);
        const down = Math.max(1, (bottom ? -bottom[index]! : value) * half);
        return (
          <View
            key={index}
            testID="waveform-bar"
            style={[styles.bar, { height: up + down, marginTop: half - up }]}
          />
        );
      })}
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Chips<T extends string>({
  options,
  selected,
  onSelect,
  testIDPrefix,
}: {
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  testIDPrefix: string;
}) {
  return (
    <View style={styles.chips}>
      {options.map((option) => (
        <Pressable
          key={option}
          testID={`${testIDPrefix}-${option}`}
          accessibilityRole="button"
          accessibilityState={{ selected: option === selected }}
          onPress={() => onSelect(option)}
          style={[styles.chip, option === selected && styles.chipSelected]}
        >
          <Text
            style={[
              styles.chipText,
              option === selected && styles.chipTextSelected,
            ]}
          >
            {option}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const WAVEFORM_HEIGHT = 120;
const BUBBLE_HEIGHT = 32;
const ACCENT = '#5B4CF0';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F6FA' },
  content: { paddingHorizontal: 16, gap: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#15142B' },
  subtitle: { fontSize: 14, color: '#6B6A80', marginTop: -14 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B6A80',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  track: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  trackActive: { borderColor: ACCENT },
  pressed: { opacity: 0.7 },
  trackTitle: { fontSize: 16, fontWeight: '600', color: '#15142B' },
  trackDetail: { fontSize: 13, color: '#6B6A80', marginTop: 2 },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 16,
    borderRadius: 28,
    backgroundColor: ACCENT,
  },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    marginLeft: 3,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 11,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: ACCENT,
  },
  bubbleWave: {
    height: BUBBLE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  chatBar: { width: 3, borderRadius: 1.5, backgroundColor: '#FFFFFF' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E9E8F2',
  },
  chipSelected: { backgroundColor: ACCENT },
  chipText: { fontSize: 14, color: '#15142B' },
  chipTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  result: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    minHeight: WAVEFORM_HEIGHT + 80,
  },
  status: { fontSize: 15, color: '#15142B' },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E9E8F2',
    overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: ACCENT },
  waveform: { height: WAVEFORM_HEIGHT, flexDirection: 'row' },
  bar: {
    flex: 1,
    marginHorizontal: 0.5,
    borderRadius: 1,
    backgroundColor: ACCENT,
  },
  stats: { fontSize: 13, color: '#6B6A80' },
});
