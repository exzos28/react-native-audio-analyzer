import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import CodeBlock from '@theme/CodeBlock';
import Layout from '@theme/Layout';
import Waveform from '@site/src/components/Waveform';
import styles from './index.module.css';

const FEATURES = [
  {
    title: 'Decode once, render many',
    body: 'One native pass produces min, max and RMS per bucket. Bar count, zoom, metric and scale are cheap JS on top — no second decode.',
  },
  {
    title: 'Presets and every knob',
    body: 'waveformPresets.chat, .player and .editor are plain objects tuned for voice messages, scrubbers and precise views. Spread one, override anything.',
  },
  {
    title: 'Native and non-blocking',
    body: 'One C++ core on miniaudio for iOS and Android, on a background thread, with progress and AbortSignal cancellation. Works in Expo dev builds.',
  },
  {
    title: 'Correct by construction',
    body: 'Peaks are never dropped or drawn twice, RMS is frame-weighted, the scale stays stable when zooming. Tested against naive references under sanitizers.',
  },
];

const QUICK_START = `import { useWaveform, waveformPresets } from 'react-native-audio-analyzer';

function VoiceMessage({ url }: { url: string }) {
  const { bars } = useWaveform(url, { ...waveformPresets.chat, barCount: 40 });
  return <Bars values={bars ?? []} />; // 40 numbers, 0…1
}`;

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout description={siteConfig.tagline}>
      <header className={styles.hero}>
        <div className="container">
          <h1 className={styles.title}>{siteConfig.title}</h1>
          <p className={styles.tagline}>{siteConfig.tagline}</p>
          <div className={styles.buttons}>
            <Link
              className="button button--primary button--lg"
              to="/docs/intro"
            >
              Get started
            </Link>
            <Link
              className="button button--secondary button--lg"
              to="/docs/examples"
            >
              See examples
            </Link>
          </div>
          <div className={styles.demo}>
            <Waveform
              id="voice-chat"
              variant="bubble"
              showCode={false}
              caption="A voice message rendered with waveformPresets.chat — real analysis of a LibriVox recording."
            />
          </div>
        </div>
      </header>
      <main className="container">
        <section className={styles.features}>
          {FEATURES.map((feature) => (
            <div key={feature.title} className={styles.feature}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </div>
          ))}
        </section>
        <section className={styles.quickStart}>
          <h2>Quick start</h2>
          <CodeBlock language="bash">
            npm install react-native-audio-analyzer react-native-nitro-modules
          </CodeBlock>
          <CodeBlock language="tsx">{QUICK_START}</CodeBlock>
        </section>
      </main>
    </Layout>
  );
}
