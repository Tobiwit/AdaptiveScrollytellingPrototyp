import { useRunConclusions } from '../conclusions/ConclusionsContext';
import type { Conclusion } from '../conclusions/conclude';
import { useStoredFlag } from './useStoredFlag';
import styles from './StatusCenter.module.css';

/** Compact view of the run conclusions (third layer), above the insight pop-ups. */
export function StatusCenter() {
  const run = useRunConclusions();
  const [collapsed, setCollapsed] = useStoredFlag('signals-status-collapsed');

  return (
    <section className={styles.card} aria-label="Run status">
      <header className={styles.head}>
        <strong>Run</strong>
        <span className={styles.muted}>{run.calibrated ? 'calibrated' : 'calibrating'}</span>
        <span className={styles.grow} />
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
      <p className={styles.would}>
        <span className={styles.muted}>would:</span> {run.wouldDo.join(' · ')}
      </p>
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
