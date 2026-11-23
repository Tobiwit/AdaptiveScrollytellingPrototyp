import { useEffect, useState } from 'react';
import { DEFAULTS, getAt, loadOverrides, saveOverrides, type Leaf, type Overrides } from './tuning';
import { CONCLUSION_VALUES, type Dimension } from '../policy/config';
import { DIMENSIONS } from '../policy/AdaptivePolicy';
import type { ConclusionId } from '../conclusions/conclude';
import { loadLastRun } from '../recording/RecorderContext';
import { downloadRun } from '../recording/recorder';
import styles from './TuningPage.module.css';

const DIM_LABELS: Record<Dimension, string> = { length: 'Text length', depth: 'Context depth', size: 'Image size', presence: 'Image presence' };

// cut-offs live in conclusions.<id>
const CUTOFFS: Partial<Record<ConclusionId, [key: string, label: string][]>> = {
  textNeed: [
    ['short', 'short <'],
    ['long', 'long >'],
  ],
  context: [
    ['low', 'low <'],
    ['lowVsWorks', 'or vs works <'],
    ['high', 'high >'],
    ['highVsWorks', 'and vs works >'],
  ],
  visual: [
    ['textLed', 'text-led <'],
    ['imageLed', 'image-led >'],
    ['pointerWeight', 'pointer weight'],
  ],
  trend: [
    ['falling', 'falling <'],
    ['rising', 'rising >'],
  ],
};

const SOURCES: Partial<Record<ConclusionId, string>> = {
  textNeed: 'text verdicts ← dwell vs expected, pace, scroll speed, text progress, idle',
  context: 'section-text verdicts vs work-text verdicts',
  visual: 'image vs text verdicts, pointer on images',
  trend: 'recent vs earlier verdicts, skips, scroll tempo',
  strain: 'pace, re-reads, unfinished texts, idle',
  navigation: 'scroll-backs, nav jumps',
  trust: 'pointer reliability, device, verdicts, nav jumps',
};

const POLICY: [path: string, label: string][] = [
  ['policy.requireCalibration', 'require calibration'],
  ['policy.minConfidence', 'min confidence'],
  ['policy.maxStepPerChapter', 'max step per chapter'],
];

export function TuningPage() {
  const [overrides, setOverrides] = useState<Overrides>(loadOverrides);
  const changed = Object.keys(overrides).length;

  useEffect(() => {
    document.title = 'Tuning';
  }, []);

  const value = (path: string) => (path in overrides ? overrides[path] : (getAt(DEFAULTS, path) as Leaf));
  const replace = (next: Overrides) => {
    setOverrides(next);
    saveOverrides(next);
  };
  const set = (path: string, v: Leaf) => {
    const next = { ...overrides };
    if (v === getAt(DEFAULTS, path)) delete next[path];
    else next[path] = v;
    replace(next);
  };
  const edit = { value, set, overrides };

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>Tuning</h1>
        <a href="/?adaptive&debug">exhibition (adaptive)</a>
        <span className={styles.grow} />
        <LastRun />
        <button type="button" onClick={() => navigator.clipboard.writeText(JSON.stringify(overrides, null, 2))}>
          Copy JSON
        </button>
        <button type="button" onClick={() => pasteJson(replace)}>
          Paste JSON
        </button>
        <button type="button" onClick={() => replace({})} disabled={!changed}>
          Reset all{changed ? ` (${changed})` : ''}
        </button>
      </header>

      <h2>Signal adaptation</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Adaptation</th>
            <th>Conclusion</th>
            <th>Cut-offs</th>
            <th>From</th>
          </tr>
        </thead>
        <tbody>
          {DIMENSIONS.map((dim) => (
            <RuleRow key={dim} dim={dim} {...edit} />
          ))}
        </tbody>
      </table>

      <h2>Policy</h2>
      <table className={styles.table}>
        <tbody>
          {POLICY.map(([path, label]) => (
            <tr key={path}>
              <td className={styles.label}>{label}</td>
              <td>
                <Field path={path} {...edit} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LastRun() {
  const [run] = useState(loadLastRun);
  if (!run) return null;
  const when = new Date(run.meta.startedAt).toLocaleString();
  return (
    <button type="button" onClick={() => downloadRun(run)} title={`${run.meta.condition}, started ${when}`}>
      Last run ↓
    </button>
  );
}

interface EditProps {
  value: (path: string) => Leaf;
  set: (path: string, v: Leaf) => void;
  overrides: Overrides;
}

function RuleRow({ dim, ...edit }: EditProps & { dim: Dimension }) {
  const base = `policy.rules.${dim}`;
  const from = edit.value(`${base}.from`) as ConclusionId;
  const enabled = !!edit.value(`${base}.enabled`);
  return (
    <tr data-off={!enabled || undefined}>
      <td>
        <label className={styles.check}>
          <input type="checkbox" checked={enabled} onChange={(e) => edit.set(`${base}.enabled`, e.target.checked)} />
          {DIM_LABELS[dim]}
        </label>
      </td>
      <td>
        <select value={from} onChange={(e) => edit.set(`${base}.from`, e.target.value)} data-changed={`${base}.from` in edit.overrides || undefined}>
          {Object.keys(CONCLUSION_VALUES).map((id) => (
            <option key={id}>{id}</option>
          ))}
        </select>
        <div className={styles.muted}>{CONCLUSION_VALUES[from]?.join(' · ')}</div>
      </td>
      <td>
        <div className={styles.cutoffs}>
          {(CUTOFFS[from] ?? []).map(([key, label]) => (
            <label key={key}>
              {label}
              <Field path={`conclusions.${from}.${key}`} {...edit} />
            </label>
          ))}
          {!CUTOFFS[from] && <span className={styles.muted}>fixed</span>}
        </div>
      </td>
      <td className={styles.muted}>{SOURCES[from]}</td>
    </tr>
  );
}

function Field({ path, value, set, overrides }: EditProps & { path: string }) {
  const def = getAt(DEFAULTS, path);
  const v = value(path);
  const changed = path in overrides;
  const title = `default ${String(def)}`;
  if (typeof def === 'boolean') {
    return <input type="checkbox" checked={!!v} onChange={(e) => set(path, e.target.checked)} title={title} />;
  }
  return (
    <span className={styles.field} data-changed={changed || undefined}>
      <NumberInput value={v as number} onChange={(n) => set(path, n)} title={title} />
      {changed && (
        <button type="button" className={styles.reset} onClick={() => set(path, def as Leaf)} title={title}>
          ×
        </button>
      )}
    </span>
  );
}

function NumberInput({ value, onChange, title }: { value: number; onChange: (n: number) => void; title: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <input
      type="number"
      step="any"
      value={text}
      title={title}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== '' && Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

function pasteJson(replace: (o: Overrides) => void) {
  const raw = prompt('Paste tuning JSON');
  if (!raw) return;
  try {
    replace(JSON.parse(raw));
  } catch {
    alert('Not valid JSON');
  }
}
