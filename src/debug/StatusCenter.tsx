import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRunConclusions } from '../conclusions/ConclusionsContext';
import { useNewRun } from '../signals/SignalsContext';
import { useAdaptivePolicy, usePlannedSteps } from '../policy/PolicyContext';
import { DIMENSIONS, STEP_LABELS } from '../policy/AdaptivePolicy';
import type { Conclusion } from '../conclusions/conclude';
import { useStoredFlag } from './useStoredFlag';
import styles from './StatusCenter.module.css';

export function StatusCenter() {
  const run = useRunConclusions();
  const [collapsed, setCollapsed] = useStoredFlag('signals-status-collapsed');
  const newRun = useNewRun();
  const policy = useAdaptivePolicy();
  const planned = usePlannedSteps();
  const [waiting, setWaiting] = useState(false);

  // No scrolling behind the start screen.
  useEffect(() => {
    if (!waiting) return;
    const root = document.documentElement;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = '';
    };
  }, [waiting]);

  const reset = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setWaiting(true);
  };
  const start = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    newRun();
    setWaiting(false);
  };

  return (
    <section className={styles.card} aria-label="Run status">
      <header className={styles.head}>
        <strong>Run</strong>
        <span className={styles.muted}>{run.calibrated ? 'calibrated' : 'calibrating'}</span>
        <span className={styles.grow} />
        <button onClick={reset} title="Reset run: back to the top, all statistics cleared">
          reset
        </button>
        <button onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}>
          {collapsed ? '+' : '–'}
        </button>
      </header>
      {!collapsed && (
        <ul className={styles.rows}>
          {run.items.map((c) => (
            <Row key={c.id} c={c} />
          ))}
        </ul>
      )}
      {policy && planned ? (
        <p className={styles.would}>
          <span className={styles.muted}>next ({policy.status}):</span> {DIMENSIONS.map((d) => STEP_LABELS[d][planned[d]]).join(' · ')}
        </p>
      ) : (
        <p className={styles.would}>
          <span className={styles.muted}>would:</span> {run.wouldDo.join(' · ')}
        </p>
      )}
      {waiting &&
        createPortal(
          <button className={styles.gate} onClick={start} data-signals-ignore autoFocus>
            Click to start
          </button>,
          document.body,
        )}
    </section>
  );
}

function Row({ c }: { c: Conclusion }) {
  return (
    <li className={styles.row} title={c.waiting ?? c.evidence.join('\n')} data-settled={c.settled || undefined}>
      <span className={styles.label}>{c.label}</span>
      <span className={styles.value}>
        {c.waiting ? <span className={styles.muted}>{c.waiting}</span> : c.value}
        {c.trend && <span className={styles.trend}>{c.trend === 'up' ? '↑' : '↓'}</span>}
      </span>
      <Meter v={c.meter} />
      <span className={styles.conf}>{c.value === '–' || c.waiting ? '' : `${Math.round(c.confidence * 100)}%`}</span>
      <span className={styles.dot} aria-label={c.settled ? 'settled' : 'settling'}>
        {c.settled ? '●' : '○'}
      </span>
    </li>
  );
}

function Meter({ v }: { v: number | null }) {
  const filled = v === null ? 0 : Math.round(v * 4) + 1;
  return (
    <span className={styles.meter} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <i key={i} data-on={(v !== null && i <= filled) || undefined} />
      ))}
    </span>
  );
}
