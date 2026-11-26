import { useEffect, useState } from 'react';
import { useSignalSnapshot, useSignalTracker } from '../signals/SignalsContext';
import { signalConfig } from '../signals/config';
import type { SignalEvent, UnitSnapshot } from '../signals/types';
import { useInsightState } from '../insights/InsightsContext';
import type { UnitVerdict } from '../insights/types';
import { InsightToasts } from './InsightToasts';
import { StatusCenter } from './StatusCenter';
import { useStoredFlag } from './useStoredFlag';
import { useAdaptivePolicy } from '../policy/PolicyContext';
import { useRecorder, useUploadStatus } from '../recording/RecorderContext';
import { downloadRun } from '../recording/recorder';
import styles from './DebugOverlay.module.css';

const allowed = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');

/** Temporary. Dev or ?debug, Shift+D toggles. */
export function DebugOverlay() {
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).has('debug'));
  const [minimized, setMinimized] = useStoredFlag('signals-debug-minimized');
  const [popups, setPopups] = useStoredFlag('signals-debug-popups', true);
  const adaptive = !!useAdaptivePolicy();

  useEffect(() => {
    if (!allowed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === 'd') setOpen((o) => !o);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  if (!allowed || !open) {
    return adaptive ? (
      <div className={styles.leftColumn} data-signals-ignore>
        <InsightToasts onlyAdaptations />
      </div>
    ) : null;
  }
  return (
    <>
      <div className={styles.leftColumn} data-signals-ignore>
        <StatusCenter />
        {popups && <InsightToasts />}
      </div>
      <Panel
        onClose={() => setOpen(false)}
        minimized={minimized}
        onMinimize={() => setMinimized(!minimized)}
        popups={popups}
        onPopups={setPopups}
      />
    </>
  );
}

interface PanelProps {
  onClose: () => void;
  minimized: boolean;
  onMinimize: () => void;
  popups: boolean;
  onPopups: (on: boolean) => void;
}

function Panel({ onClose, minimized, onMinimize, popups, onPopups }: PanelProps) {
  const snap = useSignalSnapshot();
  const tracker = useSignalTracker();
  const insight = useInsightState();
  const recorder = useRecorder();
  const upload = useUploadStatus();
  const [seenOnly, setSeenOnly] = useState(true);
  const { session: s, focus } = snap;

  useEffect(() => {
    const el = s.focusUnitId ? tracker.getElement(s.focusUnitId) : null;
    el?.setAttribute('data-debug-focus', '');
    return () => el?.removeAttribute('data-debug-focus');
  }, [s.focusUnitId, tracker]);

  const units = seenOnly ? snap.units.filter((u) => u.visits > 0 || u.bandMs > 0) : snap.units;
  const state = !s.visible ? 'hidden' : s.idle ? 'idle' : 'active';

  if (minimized) {
    return (
      <aside className={`${styles.panel} ${styles.mini}`} data-signals-ignore aria-label="Signal debug overlay">
        <header className={styles.head}>
          <strong>Signals</strong>
          <span className={styles.state} data-state={state}>
            {state}
          </span>
          <span className={styles.miniFocus}>{focus ? focus.label : '–'}</span>
          <button onClick={onMinimize} aria-label="Expand" title="Expand">
            ▢
          </button>
          <button onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
      </aside>
    );
  }

  const p = insight.profile;
  const verdictCounts = Object.values(insight.verdicts).reduce<Record<string, number>>((acc, v) => {
    acc[v.engagement] = (acc[v.engagement] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <div className={styles.band} aria-hidden="true" style={{ top: `${signalConfig.band[0] * 100}%`, bottom: `${(1 - signalConfig.band[1]) * 100}%` }} />
      <div className={styles.line} aria-hidden="true" style={{ top: `${signalConfig.readingLine * 100}%` }} />

      <aside className={styles.panel} data-signals-ignore aria-label="Signal debug overlay">
        <header className={styles.head}>
          <strong>Signals</strong>
          <span className={styles.state} data-state={state}>
            {state}
          </span>
          <span className={styles.grow} />
          {upload && <span className={styles.muted} title={upload.at ? new Date(upload.at).toLocaleTimeString() : ''}>{upload.state === 'idle' ? 'not uploaded yet' : upload.state}</span>}
          {recorder && <button onClick={() => downloadRun(recorder.toJSON())}>download run</button>}
          <button onClick={onMinimize} aria-label="Minimise" title="Minimise">
            –
          </button>
          <button onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <Block title="Session">
          <Row k="elapsed" v={clock(s.elapsedMs)} />
          <Row k="active / idle / hidden" v={`${clock(s.activeMs)} / ${clock(s.idleMs)} / ${clock(s.hiddenMs)}`} />
          <Row k="tab · window" v={`${s.visible ? 'visible' : 'hidden'} · ${s.windowFocused ? 'focused' : 'not focused'}`} />
          <Row
            k="since input"
            v={`${sec(s.msSinceActivity)} (idle after ${sec(s.idleThresholdMs)})`}
            warn={s.msSinceActivity > s.idleThresholdMs * 0.7}
          />
        </Block>

        <Block title="Scroll">
          <Row k="velocity" v={`${fmt(s.scroll.velocity)} vh/s ${s.scroll.velocity < -0.02 ? '↑' : s.scroll.velocity > 0.02 ? '↓' : '·'}${s.scroll.navigating ? ' (nav jump)' : ''}`} />
          <Row k="baseline (moving)" v={s.scroll.baseline !== null ? `${fmt(s.scroll.baseline)} ± ${fmt(s.scroll.baselineStd)} vh/s` : 'collecting…'} />
          <Row k="now vs baseline" v={rel(s.scroll.relSpeed)} />
          <Row k="last ~3 s vs baseline" v={rel(s.scroll.recentRelSpeed)} warn={(s.scroll.recentRelSpeed ?? 1) > 1.8 || (s.scroll.recentRelSpeed ?? 1) < 0.5} />
          <Row k="scroll-backs" v={`${s.scroll.backscrolls} (${fmt(s.scroll.backscrollVh)} vh)`} />
          <Row k="distance · nav jumps" v={`${fmt(s.scroll.distanceVh, 1)} vh · ${s.navJumps}`} />
        </Block>

        <Block title="Pointer & reading">
          <Row k="pointer" v={`${s.pointer.type ?? '–'} · ${s.pointer.inside ? (s.pointer.engaged ? 'moving' : 'resting') : 'outside'}`} />
          <Row k="over" v={s.pointer.unitId ? `${labelOf(snap.units, s.pointer.unitId)} [${s.pointer.part}]` : '–'} />
          <Row k="pointer follows reading" v={pct(s.pointer.onFocusShare)} />
          <Row k="focus by" v={s.focusUnitId && s.focusUnitId !== s.bandFocusUnitId ? 'pointer' : 'reading band'} />
          <Row k="clicks" v={String(s.clicks)} />
          <Row k="reading pace" v={s.readingPaceWpm ? `${Math.round(s.readingPaceWpm)} wpm (n=${s.paceSamples}, default ${signalConfig.readingWpm})` : `– (default ${signalConfig.readingWpm} wpm)`} />
        </Block>

        <Block
          title="Interpretation"
          extra={
            <label className={styles.toggle}>
              <input type="checkbox" checked={popups} onChange={(e) => onPopups(e.target.checked)} /> pop-ups
            </label>
          }
        >
          <Row
            k="reading style"
            v={p.readingStyle ? `${p.readingStyle} (${pct(p.styleConfidence)}, ${p.styleBasis} texts)` : '– (needs 4 texts)'}
          />
          <Row k="scroll tempo" v={p.scrollTempo} warn={p.scrollTempo !== 'normal'} />
          <Row k="pointer as gaze proxy" v={p.pointerFollowsReading === null ? 'unknown yet' : p.pointerFollowsReading ? 'usable' : 'not usable'} />
          <Row
            k="verdicts"
            v={
              Object.entries(verdictCounts)
                .map(([k, n]) => `${k} ${n}`)
                .join(' · ') || '–'
            }
          />
          <Row k="insights drawn" v={String(insight.insights.length)} />
        </Block>

        <Block title="Focused unit">{focus ? <Focus u={focus} /> : <p className={styles.muted}>nothing in focus</p>}</Block>

        <Block
          title={`Units (${units.length}/${snap.units.length})`}
          extra={
            <label className={styles.toggle}>
              <input type="checkbox" checked={seenOnly} onChange={(e) => setSeenOnly(e.target.checked)} /> seen only
            </label>
          }
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th>unit</th>
                <th title="dwell / expected">dwell</th>
                <th title="dwell ÷ expected">ratio</th>
                <th title="visits · returns via scroll-back">v·r</th>
                <th title="text progress">read</th>
                <th title="scroll speed vs baseline">spd</th>
                <th title="pointer time on image">img</th>
                <th title="verdict (confidence)">verdict</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.unitId} data-focus={u.unitId === s.focusUnitId || undefined}>
                  <td className={styles.label} title={u.unitId}>
                    <span className={styles.kind}>{u.kind === 'work' ? 'W' : 'T'}</span>
                    {u.label}
                  </td>
                  <td>
                    {sec(u.dwellMs, 0)}/{sec(u.expectedMs, 0)}
                  </td>
                  <td>
                    <Ratio r={u.readingRatio} />
                  </td>
                  <td>
                    {u.visits}·{u.returns}
                    {u.skips ? ' skip' : ''}
                  </td>
                  <td>{u.words ? pct(u.textProgress) : '–'}</td>
                  <td>{u.relSpeed !== null ? fmt(u.relSpeed, 1) + '×' : '–'}</td>
                  <td>{u.hoverMs.image ? sec(u.hoverMs.image, 1) : '–'}</td>
                  <td>
                    <Verdict v={insight.verdicts[u.unitId]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>

        <Block title="Events">
          <ol className={styles.events}>
            {[...snap.events].reverse().map((e, i) => (
              <li key={`${e.t}-${i}`}>
                <span className={styles.muted}>{clock(e.t)}</span> {describe(e, snap.units)}
              </li>
            ))}
          </ol>
        </Block>
      </aside>
    </>
  );
}

function Focus({ u }: { u: UnitSnapshot }) {
  return (
    <>
      <p className={styles.focusLabel}>
        <span className={styles.kind}>{u.kind === 'work' ? 'W' : 'T'}</span>
        {u.label} <span className={styles.muted}>· {u.sectionId}</span>
      </p>
      <Row k="dwell / expected" v={`${sec(u.dwellMs)} / ${sec(u.expectedMs)}${u.expectedPersonalMs ? ` (your pace ${sec(u.expectedPersonalMs)})` : ''}`} />
      <Row k="ratio" v={<Ratio r={u.readingRatio} wide />} />
      <Row k="this visit" v={sec(u.currentVisitMs)} />
      <Row k="words · image" v={`${u.words} · ${u.hasImage ? (u.size ?? 'M') : 'no'}`} />
      <Row k="visits · returns · left back" v={`${u.visits} · ${u.returns} · ${u.leftBackward}`} />
      <Row k="text read" v={u.words ? pct(u.textProgress) : '–'} />
      <Row k="speed vs baseline" v={u.relSpeed !== null ? `${fmt(u.relSpeed, 2)}× · moving ${pct(u.movingShare)}` : '–'} />
      <Row k="pointer img / txt / cap" v={`${sec(u.hoverMs.image)} / ${sec(u.hoverMs.text)} / ${sec(u.hoverMs.caption)}`} />
      <Row k="clicks img / txt / other" v={`${u.clicks.image} / ${u.clicks.text} / ${u.clicks.caption + u.clicks.other}`} />
      <Row k="idle starts" v={String(u.idleStarts)} />
    </>
  );
}

function Verdict({ v }: { v?: UnitVerdict }) {
  if (!v) return <span className={styles.muted}>…</span>;
  return (
    <span title={v.evidence.join(' · ')}>
      {v.engagement} <span className={styles.muted}>{Math.round(v.confidence * 100)}</span>
    </span>
  );
}

function Block({ title, extra, children }: { title: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={styles.block}>
      <h4>
        {title}
        {extra}
      </h4>
      {children}
    </section>
  );
}

function Row({ k, v, warn }: { k: string; v: React.ReactNode; warn?: boolean }) {
  return (
    <div className={styles.row} data-warn={warn || undefined}>
      <span className={styles.k}>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function Ratio({ r, wide }: { r: number; wide?: boolean }) {
  const tone = r === 0 ? 'none' : r < 0.3 ? 'low' : r <= 1.3 ? 'ok' : 'high';
  return (
    <span className={styles.ratio} data-wide={wide || undefined}>
      <span className={styles.bar} data-tone={tone} style={{ width: `${Math.min(r, 2) * 50}%` }} />
      <span className={styles.ratioText}>{fmt(r, 2)}</span>
    </span>
  );
}

const fmt = (n: number | null | undefined, d = 2) => (n === null || n === undefined ? '–' : n.toFixed(d));
const sec = (ms: number, d = 1) => `${(ms / 1000).toFixed(d)}s`;
const pct = (x: number | null) => (x === null ? '–' : `${Math.round(x * 100)}%`);
const rel = (x: number | null) => (x === null ? '–' : `${x.toFixed(2)}×`);
const clock = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
const labelOf = (units: UnitSnapshot[], id: string | null) => (id ? (units.find((u) => u.unitId === id)?.label ?? id) : '–');

function describe(e: SignalEvent, units: UnitSnapshot[]): string {
  switch (e.type) {
    case 'focus-enter':
      return `→ ${labelOf(units, e.unitId)}`;
    case 'focus-exit':
      return `← ${labelOf(units, e.unitId)} (${sec(e.visitMs)})`;
    case 'skip':
      return `skipped ${labelOf(units, e.unitId)} (${sec(e.visitMs)} of ${sec(e.expectedMs)})`;
    case 'backscroll':
      return `scroll-back ${e.distanceVh} vh → ${labelOf(units, e.toUnitId)}`;
    case 'idle-start':
      return `idle (no input for ${sec(e.afterMs)})`;
    case 'idle-end':
      return `back after ${sec(e.idleMs)}`;
    case 'visibility':
      return e.visible ? 'tab visible' : 'tab hidden';
    case 'window-focus':
      return e.focused ? 'window focused' : 'window lost focus';
    case 'hover':
      return `pointer on ${e.part} of ${labelOf(units, e.unitId)} (${sec(e.ms)})`;
    case 'click':
      return `click ${e.target}${e.unitId ? ` on ${e.part} of ${labelOf(units, e.unitId)}` : ''}`;
    case 'nav-jump':
      return `jump to ${e.href}`;
    case 'image-open':
      return `opened ${labelOf(units, e.unitId)} full screen`;
    case 'image-close':
      return `closed ${labelOf(units, e.unitId)} (${sec(e.ms)})`;
    case 'expand':
      return `${e.open ? 'opened' : 'closed'} more text on ${labelOf(units, e.unitId)}`;
  }
}
