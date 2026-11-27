import { useEffect, useRef, useState } from 'react';
import type { Dimension } from './config';
import { DIMENSIONS } from './AdaptivePolicy';
import { useAdaptivePolicy, usePlannedSteps } from './PolicyContext';
import styles from './AdaptationStatus.module.css';

const LABELS: Record<Dimension, string> = { length: 'Text length', depth: 'Background texts', size: 'Image size', presence: 'Images' };
const STEPS: Record<Dimension, [string, string, string]> = {
  length: ['Shorter', 'Original', 'Longer'],
  depth: ['Folded', 'Original', 'More'],
  size: ['Smaller', 'Original', 'Larger'],
  presence: ['Text first', 'Original', 'Images first'],
};

/** Corner circle once anything is adapted; lists the active changes with "Revert all". */
export function AdaptationStatus() {
  const policy = useAdaptivePolicy();
  const planned = usePlannedSteps();
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(false);
  const [reverted, setReverted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      policy?.decisions.subscribe((d) => {
        if (d.via === 'revert') return;
        setUnseen(true);
        setReverted(false);
      }),
    [policy],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onDown = (e: PointerEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    addEventListener('keydown', onKey);
    addEventListener('pointerdown', onDown);
    return () => {
      removeEventListener('keydown', onKey);
      removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  if (!policy || !planned) return null;
  const active = DIMENSIONS.filter((d) => planned[d] !== 1);
  if (!active.length && !(open && reverted)) return null;

  return (
    <div ref={rootRef} className={styles.root} data-signals-ignore>
      {open && (
        <div className={styles.panel} role="dialog" aria-label="Active adaptations">
          {reverted ? (
            <p className={styles.note}>Back to the original from the next chapter on. Nothing else will change.</p>
          ) : (
            <>
              <p className={styles.title}>These adaptations are currently active</p>
              {active.map((d) => (
                <div key={d} className={styles.item}>
                  <span className={styles.label}>{LABELS[d]}</span>
                  <span className={styles.pills}>
                    {STEPS[d].map((step, i) => (
                      <span key={step} className={styles.pill} data-on={i === planned[d] || undefined}>
                        {step}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
              <button
                type="button"
                className={styles.revert}
                onClick={() => {
                  policy.revertAll();
                  setReverted(true);
                }}
              >
                Revert all
              </button>
            </>
          )}
        </div>
      )}
      <button
        type="button"
        className={styles.circle}
        onClick={() => {
          setOpen((o) => !o);
          setUnseen(false);
        }}
        aria-expanded={open}
        aria-label="Active adaptations"
        title="Active adaptations"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
          <circle cx="15" cy="7" r="2" />
          <circle cx="9" cy="17" r="2" />
        </svg>
        {unseen && !open && <span className={styles.dot} />}
      </button>
    </div>
  );
}
