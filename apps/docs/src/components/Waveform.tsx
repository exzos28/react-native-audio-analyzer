import CodeBlock from '@theme/CodeBlock';
import data from '@site/src/generated/examples.json';
import styles from './Waveform.module.css';

type ExampleId = keyof typeof data.examples;

interface WaveformProps {
  /** Example rendered by scripts/render-examples.mts. */
  id: ExampleId;
  /** `bubble` draws a chat bubble around the waveform. */
  variant?: 'bubble' | 'strip';
  caption?: string;
  /** Show the library calls that produced the picture. Default true. */
  showCode?: boolean;
}

/**
 * A waveform computed from real audio by the library itself at build time
 * (see examples/README.md). The SVG path comes from `waveformPath`.
 */
export default function Waveform({
  id,
  variant = 'strip',
  caption,
  showCode = true,
}: WaveformProps) {
  const example = data.examples[id];
  const svg = (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${example.width} ${example.height}`}
      width={example.width}
      height={example.height}
      role="img"
      aria-label={caption ?? `Waveform example ${id}`}
    >
      <path d={example.d} />
    </svg>
  );
  return (
    <figure className={styles.figure}>
      {variant === 'bubble' ? (
        <div className={styles.bubble}>
          <span className={styles.play} aria-hidden />
          {svg}
        </div>
      ) : (
        <div className={styles.strip}>{svg}</div>
      )}
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
      {showCode && (
        <CodeBlock language="ts" className={styles.code}>
          {example.code}
        </CodeBlock>
      )}
    </figure>
  );
}
