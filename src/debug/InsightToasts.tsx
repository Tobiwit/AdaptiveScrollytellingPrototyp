import { useEffect, useState } from 'react';
import { useInsightEngine } from '../insights/InsightsContext';
import { ENGAGEMENT_RANK, type Insight } from '../insights/types';
import { useAdaptivePolicy } from '../policy/PolicyContext';
import styles from './InsightToasts.module.css';

const SHOW_MS = 8000;
const ADAPT_SHOW_MS = 12_000;
const MAX = 6;

interface Toast {
  key: string;
  message: string;
  confidence: number;
  evidence: string[];
  tone: string;
  until: number;
}

export function InsightToasts({ onlyAdaptations = false }: { onlyAdaptations?: boolean }) {
  const engine = useInsightEngine();
  const policy = useAdaptivePolicy();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (t: Toast) => setToasts((ts) => [...ts, t].slice(-MAX));

  useEffect(() => {
    setToasts([]); // new run
    if (onlyAdaptations) return;
    return engine.insights.subscribe((i) =>
      push({ key: `i${i.id}`, message: i.message, confidence: i.confidence, evidence: i.evidence, tone: tone(i), until: Date.now() + SHOW_MS }),
    );
  }, [engine, onlyAdaptations]);

  useEffect(() => {
    if (!policy) return;
    const offs = [
      policy.decisions.subscribe((d) =>
        push({ key: `a${d.id}`, message: d.message, confidence: d.confidence, evidence: d.evidence, tone: 'adapt', until: Date.now() + ADAPT_SHOW_MS }),
      ),
    ];
    if (!onlyAdaptations) {
      offs.push(
        policy.suggestionEvents.subscribe(({ status, suggestion: s }) =>
          push({
            key: `s${s.id}${status}`,
            message: `Suggestion ${status}`,
            confidence: s.because.confidence,
            evidence: [`${s.because.label}: ${s.because.value}`, s.changes.map((c) => `${c.dimension} ${c.from}→${c.to}`).join(', '), `at ${s.chapterId}`],
            tone: 'adapt',
            until: Date.now() + ADAPT_SHOW_MS,
          }),
        ),
      );
    }
    return () => offs.forEach((off) => off());
  }, [policy, onlyAdaptations]);

  useEffect(() => {
    if (!toasts.length) return;
    const timer = setInterval(() => setToasts((ts) => ts.filter((x) => x.until > Date.now())), 500);
    return () => clearInterval(timer);
  }, [toasts.length]);

  return (
    <ol className={styles.stack} data-signals-ignore aria-live="polite" aria-label="Insights">
      {toasts.map((t) => (
        <li key={t.key} className={styles.toast} data-tone={t.tone}>
          <div className={styles.top}>
            <span className={styles.message}>{t.message}</span>
            <span className={styles.conf} title="confidence">
              {Math.round(t.confidence * 100)}%
            </span>
          </div>
          {t.evidence.length > 0 && <div className={styles.evidence}>{t.evidence.join(' · ')}</div>}
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
  if (['went-back', 'image-opened', 'text-expanded'].includes(i.kind)) return 'high';
  if (i.scope === 'chapter') return 'chapter';
  if (['inactive', 'left-tab', 'window-blur', 'pointer-unreliable'].includes(i.kind)) return 'warn';
  return 'session';
}
