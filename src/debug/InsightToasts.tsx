import { useEffect, useState } from 'react';
import { useInsightEngine } from '../insights/InsightsContext';
import { ENGAGEMENT_RANK, type Insight } from '../insights/types';
import styles from './InsightToasts.module.css';

const SHOW_MS = 8000;
const MAX = 6;

export function InsightToasts() {
  const engine = useInsightEngine();
  const [toasts, setToasts] = useState<{ insight: Insight; until: number }[]>([]);

  useEffect(() => {
    setToasts([]); // new run
    return engine.insights.subscribe((insight) =>
      setToasts((ts) => [...ts, { insight, until: Date.now() + SHOW_MS }].slice(-MAX)),
    );
  }, [engine]);

  useEffect(() => {
    if (!toasts.length) return;
    const timer = setInterval(() => setToasts((ts) => ts.filter((x) => x.until > Date.now())), 500);
    return () => clearInterval(timer);
  }, [toasts.length]);

  return (
    <ol className={styles.stack} data-signals-ignore aria-live="polite" aria-label="Insights">
      {toasts.map(({ insight: i }) => (
        <li key={i.id} className={styles.toast} data-tone={tone(i)}>
          <div className={styles.top}>
            <span className={styles.message}>{i.message}</span>
            <span className={styles.conf} title="confidence">
              {Math.round(i.confidence * 100)}%
            </span>
          </div>
          {i.evidence.length > 0 && <div className={styles.evidence}>{i.evidence.join(' · ')}</div>}
        </li>
      ))}
    </ol>
  );
}

function tone(i: Insight): string {
  if (i.engagement) {
    const r = ENGAGEMENT_RANK[i.engagement];
    return r <= 1 ? 'low' : r === 2 ? 'mid' : 'high';
  }
  if (i.kind === 'went-back') return 'high';
  if (i.scope === 'chapter') return 'chapter';
  if (['inactive', 'left-tab', 'window-blur', 'pointer-unreliable'].includes(i.kind)) return 'warn';
  return 'session';
}
