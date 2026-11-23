import type { SignalTracker } from '../signals/tracker';
import type { SessionSnapshot, SignalEvent, UnitSnapshot } from '../signals/types';
import type { InsightEngine } from '../insights/engine';
import type { Insight, UnitVerdict, VisitorProfile } from '../insights/types';
import type { RunConclusions } from '../conclusions/conclude';
import type { AdaptivePolicy, Decision } from '../policy/AdaptivePolicy';
import { loadOverrides, type Overrides } from '../tuning/tuning';

export const RUN_FORMAT = 'run/1';

export interface RunMeta {
  sessionId: string;
  participant: string | null;
  condition: 'static' | 'adaptive';
  exhibition: string;
  contentHash: string;
  build: string;
  startedAt: string;
  endedAt?: string;
  tuning: Overrides;
  device: SessionSnapshot['context'] & { userAgent: string };
}

/** Everything judgeUnit() and concludeRun() need, so verdicts and conclusions can be recomputed offline. */
interface Checkpoint {
  t: number;
  reason: string;
  chapterId: string | null;
  session: SessionSnapshot;
  units: UnitSnapshot[];
  profile: VisitorProfile;
}

export interface RunFile {
  format: typeof RUN_FORMAT;
  meta: RunMeta;
  events: SignalEvent[];
  insights: Insight[];
  /** every (re)judgement with the unit measurements it was based on */
  verdicts: { t: number; verdict: UnitVerdict; unit: UnitSnapshot | null }[];
  /** whenever a value (except progress), settled flag or calibration changes */
  conclusions: { t: number; calibrated: boolean; items: { id: string; value: string; confidence: number; settled: boolean }[] }[];
  decisions: (Decision & { t: number })[];
  /** on every new chapter and at the end */
  checkpoints: Checkpoint[];
}

export class RunRecorder {
  private file: RunFile;
  private seen = new Map<string, UnitVerdict>();
  private chapters = new Set<string>();
  private lastConclusions = '';
  private teardown: (() => void)[] = [];

  constructor(
    private readonly tracker: SignalTracker,
    private readonly engine: InsightEngine,
    private readonly policy: AdaptivePolicy | null,
    meta: Pick<RunMeta, 'condition' | 'exhibition' | 'contentHash'>,
  ) {
    const params = new URLSearchParams(location.search);
    this.file = {
      format: RUN_FORMAT,
      meta: {
        ...meta,
        sessionId: crypto.randomUUID(),
        participant: params.get('pid'),
        build: __BUILD__,
        startedAt: new Date().toISOString(),
        tuning: loadOverrides(),
        device: { ...tracker.getSnapshot().session.context, userAgent: navigator.userAgent },
      },
      events: [],
      insights: [],
      verdicts: [],
      conclusions: [],
      decisions: [],
      checkpoints: [],
    };
  }

  get sessionId() {
    return this.file.meta.sessionId;
  }

  start() {
    this.teardown.push(
      this.tracker.events.subscribe((e) => this.file.events.push(e)),
      this.tracker.subscribe(() => this.onTick()),
      this.engine.insights.subscribe((i) => this.file.insights.push(i)),
      this.engine.subscribe(() => this.onVerdicts()),
    );
    if (this.policy) this.teardown.push(this.policy.decisions.subscribe((d) => this.file.decisions.push({ ...d, t: this.now() })));
  }

  stop() {
    for (const off of this.teardown.splice(0)) off();
  }

  conclude(run: RunConclusions) {
    const items = run.items.map((c) => ({ id: c.id, value: c.value, confidence: round(c.confidence), settled: c.settled }));
    // progress has the clock in its value; it's in the checkpoints anyway
    const key = `${run.calibrated}|${items
      .filter((c) => c.id !== 'progress')
      .map((c) => `${c.id}:${c.value}:${c.settled}`)
      .join(',')}`;
    if (key === this.lastConclusions) return;
    this.lastConclusions = key;
    this.file.conclusions.push({ t: this.now(), calibrated: run.calibrated, items });
  }

  /** The run so far, with a final checkpoint. */
  toJSON(): RunFile {
    const snap = this.tracker.getSnapshot();
    return {
      ...this.file,
      meta: { ...this.file.meta, endedAt: new Date().toISOString() },
      checkpoints: [...this.file.checkpoints, this.checkpoint('end', null, snap)],
    };
  }

  private now() {
    return Math.round(this.tracker.getSnapshot().session.elapsedMs);
  }

  private onTick() {
    const snap = this.tracker.getSnapshot();
    const unit = snap.units.find((u) => u.unitId === snap.session.bandFocusUnitId);
    if (!unit || this.chapters.has(unit.chapterId)) return;
    this.chapters.add(unit.chapterId);
    this.file.checkpoints.push(this.checkpoint('chapter', unit.chapterId, snap));
  }

  private onVerdicts() {
    const snap = this.tracker.getSnapshot();
    for (const v of Object.values(this.engine.getState().verdicts)) {
      if (this.seen.get(v.unitId) === v) continue;
      this.seen.set(v.unitId, v);
      this.file.verdicts.push({ t: Math.round(v.at), verdict: v, unit: snap.units.find((u) => u.unitId === v.unitId) ?? null });
    }
  }

  private checkpoint(reason: string, chapterId: string | null, snap = this.tracker.getSnapshot()): Checkpoint {
    return {
      t: Math.round(snap.session.elapsedMs),
      reason,
      chapterId,
      session: snap.session,
      units: snap.units.filter((u) => u.visits > 0 || u.bandMs > 0),
      profile: this.engine.getState().profile,
    };
  }
}

export function downloadRun(run: RunFile) {
  const blob = new Blob([JSON.stringify(run)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `run-${run.meta.startedAt.slice(0, 19).replace(/[:T]/g, '-')}-${run.meta.condition}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** FNV-1a, enough to tell content versions apart */
export function hashContent(value: unknown): string {
  let h = 0x811c9dc5;
  for (const ch of JSON.stringify(value)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const round = (x: number) => Math.round(x * 1000) / 1000;
