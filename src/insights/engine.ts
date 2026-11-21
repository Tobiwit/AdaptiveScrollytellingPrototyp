import { createEventBus } from '../signals/bus';
import type { SignalTracker } from '../signals/tracker';
import type { SignalEvent, SignalSnapshot, UnitSnapshot } from '../signals/types';
import { signalConfig } from '../signals/config';
import { insightConfig as C } from './config';
import { describeEngagement, judgeUnit, sec } from './judge';
import {
  ENGAGEMENT_RANK,
  type Insight,
  type InsightState,
  type ReadingStyle,
  type UnitVerdict,
  type VisitorProfile,
} from './types';

type NewInsight = Omit<Insight, 'id' | 't'> & { t?: number };

/**
 * The layer above the raw signals: turns what the SignalTracker measures into
 * conclusions with a confidence ("only skimmed X", "inactive", "scrolls faster
 * than usual", …), keeps a verdict per unit and a profile of the visitor.
 * Adaptation decisions will read from this, not from the raw signals.
 */
export class InsightEngine {
  /** Every new insight as it's drawn (the debug toasts listen here). */
  readonly insights = createEventBus<Insight>();

  private listeners = new Set<() => void>();
  private history: Insight[] = [];
  private verdicts = new Map<string, UnitVerdict>();
  /** Units that left focus and wait to be judged: unitId → exit time. */
  private pending = new Map<string, number>();
  private nextId = 1;
  private state: InsightState;
  private dirty = false;
  private teardown: (() => void)[] = [];

  private lastBandId: string | null = null;
  private lastBandOrder: number | null = null;
  private lastChapterId: string | null = null;
  private tempo: VisitorProfile['scrollTempo'] = 'normal';
  private intenseFlagged = new Set<string>();
  private pointerDecision: boolean | null = null;
  private lastPaceN = 0;
  private style: { style: ReadingStyle | null; confidence: number; basis: number } = { style: null, confidence: 0, basis: 0 };
  private hiddenAt: number | null = null;
  private announcedStyle: ReadingStyle | null = null;
  private chapterSummaries = new Map<string, string>();

  constructor(
    private readonly tracker: SignalTracker,
    private readonly chapterTitles: Record<string, string>,
  ) {
    this.state = this.buildState();
  }

  start() {
    if (this.teardown.length) return;
    this.teardown.push(this.tracker.events.subscribe((e) => this.onEvent(e)));
    this.teardown.push(this.tracker.subscribe(() => this.onTick()));
  }

  stop() {
    for (const off of this.teardown.splice(0)) off();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = () => this.state;

  // ---- events from the tracker ------------------------------------------------

  private onEvent(e: SignalEvent) {
    const snap = this.tracker.getSnapshot();
    switch (e.type) {
      case 'focus-enter':
        this.pending.delete(e.unitId);
        break;
      case 'focus-exit':
        this.pending.set(e.unitId, e.t);
        break;
      case 'idle-start':
        this.add({
          kind: 'inactive',
          scope: 'session',
          message: `Inactivity detected (no input for ${sec(e.afterMs)})`,
          confidence: 0.85,
          evidence: [e.unitId ? `while on “${labelOf(snap, e.unitId)}”` : 'no unit in focus'],
          unitId: e.unitId ?? undefined,
        });
        break;
      case 'idle-end':
        this.add({
          kind: 'active-again',
          scope: 'session',
          message: `Active again after ${duration(e.idleMs)}`,
          confidence: 0.99,
          evidence: [],
        });
        break;
      case 'visibility':
        if (!e.visible) {
          this.hiddenAt = e.t;
          this.add({ kind: 'left-tab', scope: 'session', message: 'Left the tab', confidence: 0.99, evidence: [] });
        } else if (this.hiddenAt !== null) {
          this.add({
            kind: 'returned-tab',
            scope: 'session',
            message: `Back on the tab after ${duration(e.t - this.hiddenAt)}`,
            confidence: 0.99,
            evidence: [],
          });
          this.hiddenAt = null;
        }
        break;
      case 'window-focus':
        if (!e.focused && snap.session.visible) {
          this.add({
            kind: 'window-blur',
            scope: 'session',
            message: 'Switched to another window (page may still be visible)',
            confidence: 0.6,
            evidence: [],
          });
        }
        break;
      case 'backscroll':
        if (e.toUnitId) {
          this.add({
            kind: 'went-back',
            scope: 'unit',
            message: `Went back to “${labelOf(snap, e.toUnitId)}”`,
            confidence: Math.min(0.99, 0.6 + e.distanceVh * 0.15),
            evidence: [`scrolled up ${e.distanceVh} screens`, e.fromUnitId ? `from “${labelOf(snap, e.fromUnitId)}”` : ''].filter(Boolean),
            unitId: e.toUnitId,
          });
        }
        break;
    }
  }

  // ---- every tracker tick -----------------------------------------------------

  private onTick() {
    const snap = this.tracker.getSnapshot();
    const t = snap.session.elapsedMs;

    // Judge units that have been out of focus long enough.
    for (const [unitId, exitAt] of this.pending) {
      if (snap.session.focusUnitId === unitId) this.pending.delete(unitId);
      else if (t - exitAt >= C.settleMs) {
        this.pending.delete(unitId);
        this.judge(snap, unitId);
      }
    }

    this.checkBandMove(snap);
    this.checkTempo(snap);
    this.checkIntenseImages(snap);
    this.checkPointer(snap);
    this.checkPace(snap);

    if (this.dirty) {
      this.dirty = false;
      this.state = this.buildState();
      for (const l of this.listeners) l();
    }
  }

  private judge(snap: SignalSnapshot, unitId: string) {
    const u = snap.units.find((x) => x.unitId === unitId);
    if (!u) return;
    const j = judgeUnit(u);
    const prev = this.verdicts.get(unitId);
    const textual = u.words >= C.minTextWords;
    const verdict: UnitVerdict = { ...j, unitId, workId: u.workId, chapterId: u.chapterId, kind: u.kind, textual, label: u.label, at: snap.session.elapsedMs };
    this.verdicts.set(unitId, verdict);
    this.dirty = true;
    if (prev?.engagement === j.engagement) return;

    // Brief pointer sweeps over images: record, but don't announce.
    if (!prev && !textual && u.dwellMs < 500) return;
    const base = describeEngagement(j.engagement, u.label, textual);
    this.add({
      kind: 'unit-verdict',
      scope: 'unit',
      message: prev ? `${base} (was ${prev.engagement})` : base,
      confidence: j.confidence,
      evidence: j.evidence,
      unitId,
      workId: u.workId,
      chapterId: u.chapterId,
      engagement: j.engagement,
    });
    this.updateStyle();
  }

  /** Reading band moved to another unit: look for units passed unseen and for chapter changes. */
  private checkBandMove(snap: SignalSnapshot) {
    const bandId = snap.session.bandFocusUnitId;
    if (!bandId || bandId === this.lastBandId) return;
    const unit = snap.units.find((u) => u.unitId === bandId);
    if (!unit) return;

    if (this.lastBandOrder !== null && unit.order > this.lastBandOrder + 1) {
      const passed = snap.units.filter(
        (u) => u.order > this.lastBandOrder! && u.order < unit.order && u.visits === 0 && u.bandMs < C.completelySkippedMaxBandMs,
      );
      for (const u of passed) this.skippedCompletely(snap, u);
    }

    if (this.lastChapterId && unit.chapterId !== this.lastChapterId) this.summarizeChapter(snap, this.lastChapterId);

    this.lastBandId = bandId;
    this.lastBandOrder = unit.order;
    this.lastChapterId = unit.chapterId;
  }

  private skippedCompletely(snap: SignalSnapshot, u: UnitSnapshot) {
    if (this.verdicts.has(u.unitId)) return;
    const confidence = u.bandMs === 0 ? 0.99 : 0.9;
    const evidence = [u.bandMs === 0 ? 'never reached the reading band' : `only ${sec(u.bandMs)} in the reading band`, 'never in focus'];
    this.verdicts.set(u.unitId, {
      engagement: 'skipped',
      confidence,
      ratio: 0,
      evidence,
      unitId: u.unitId,
      workId: u.workId,
      chapterId: u.chapterId,
      kind: u.kind,
      textual: u.words >= C.minTextWords,
      label: u.label,
      at: snap.session.elapsedMs,
    });
    this.dirty = true;
    this.add({
      kind: 'skipped-completely',
      scope: 'unit',
      message: `Skipped “${u.label}” completely`,
      confidence,
      evidence,
      unitId: u.unitId,
      workId: u.workId,
      chapterId: u.chapterId,
      engagement: 'skipped',
    });
    this.updateStyle();
  }

  private summarizeChapter(snap: SignalSnapshot, chapterId: string) {
    // Judge whatever of this chapter is still waiting.
    for (const unitId of [...this.pending.keys()]) {
      if (snap.units.find((u) => u.unitId === unitId)?.chapterId === chapterId) {
        this.pending.delete(unitId);
        this.judge(snap, unitId);
      }
    }
    const vs = [...this.verdicts.values()].filter((v) => v.chapterId === chapterId);
    if (vs.length < 2) return;
    const groups = { skimmed: 0, read: 0, 'dwelled on': 0 };
    for (const v of vs) {
      const r = ENGAGEMENT_RANK[v.engagement];
      if (r <= 1) groups.skimmed++;
      else if (r === 2) groups.read++;
      else groups['dwelled on']++;
    }
    const [label, count] = Object.entries(groups).sort((a, b) => b[1] - a[1])[0];
    const share = count / vs.length;
    const message = `Chapter “${this.chapterTitles[chapterId] ?? chapterId}”: ${share > 0.5 ? 'mostly ' : ''}${label} (${count} of ${vs.length})`;
    if (this.chapterSummaries.get(chapterId) === message) return;
    this.chapterSummaries.set(chapterId, message);
    const meanConf = vs.reduce((n, v) => n + v.confidence, 0) / vs.length;
    this.add({
      kind: 'chapter-summary',
      scope: 'chapter',
      message,
      confidence: share * meanConf,
      evidence: Object.entries(groups).map(([k, n]) => `${k}: ${n}`),
      chapterId,
    });
  }

  private checkTempo(snap: SignalSnapshot) {
    const rel = snap.session.scroll.recentRelSpeed;
    if (rel === null) return;
    const ev = [`last ~3 s at ${rel.toFixed(2)}× the usual speed`, `usual ${snap.session.scroll.baseline?.toFixed(2)} vh/s`];
    if (this.tempo === 'normal' && rel > C.fastEnter) {
      this.tempo = 'fast';
      this.add({ kind: 'speed-up', scope: 'session', message: `Scrolling faster than usual (${rel.toFixed(1)}×)`, confidence: Math.min(0.95, 0.55 + (rel - C.fastEnter) * 0.3), evidence: ev });
    } else if (this.tempo === 'normal' && rel < C.slowEnter) {
      this.tempo = 'slow';
      this.add({ kind: 'slow-down', scope: 'session', message: `Scrolling slower than usual (${rel.toFixed(1)}×)`, confidence: Math.min(0.95, 0.55 + (C.slowEnter - rel) * 1.2), evidence: ev });
    } else if ((this.tempo === 'fast' && rel < C.fastExit) || (this.tempo === 'slow' && rel > C.slowExit)) {
      this.tempo = 'normal';
      this.add({ kind: 'speed-normal', scope: 'session', message: 'Back to usual scroll speed', confidence: 0.7, evidence: ev });
    }
  }

  private checkIntenseImages(snap: SignalSnapshot) {
    for (const u of snap.units) {
      if (u.hoverMs.image < C.intenseImageHoverMs || this.intenseFlagged.has(u.unitId)) continue;
      this.intenseFlagged.add(u.unitId);
      this.add({
        kind: 'image-intense',
        scope: 'unit',
        message: `Looking intensely at the image of “${u.label}”`,
        confidence: Math.min(0.95, 0.7 + (u.hoverMs.image - C.intenseImageHoverMs) / 20_000),
        evidence: [`pointer moved over the image for ${sec(u.hoverMs.image)}`],
        unitId: u.unitId,
        workId: u.workId,
        chapterId: u.chapterId,
        engagement: 'intense',
      });
    }
  }

  private checkPointer(snap: SignalSnapshot) {
    const share = snap.session.pointer.onFocusShare;
    if (share === null || snap.session.elapsedMs < C.pointerDecisionAfterMs) return;
    const ev = [`pointer on the reading-band unit ${Math.round(share * 100)}% of the time it moved`];
    if (share >= C.pointerReliableShare && this.pointerDecision !== true) {
      this.pointerDecision = true;
      this.add({ kind: 'pointer-reliable', scope: 'session', message: 'Pointer follows reading: usable as gaze proxy', confidence: Math.min(0.95, 0.5 + share / 2), evidence: ev });
    } else if (share <= C.pointerUnreliableShare && this.pointerDecision !== false) {
      this.pointerDecision = false;
      this.add({ kind: 'pointer-unreliable', scope: 'session', message: "Pointer doesn't follow reading: don't trust pointer signals", confidence: Math.min(0.95, 1 - share), evidence: ev });
    }
  }

  private checkPace(snap: SignalSnapshot) {
    const { readingPaceWpm: wpm, paceSamples: n } = snap.session;
    if (!wpm || n < C.paceEvery || n < this.lastPaceN + C.paceEvery) return;
    this.lastPaceN = n;
    const rel = wpm / signalConfig.readingWpm;
    this.add({
      kind: 'reading-pace',
      scope: 'session',
      message: `Reads at about ${Math.round(wpm)} words/min (${rel.toFixed(1)}× the default)`,
      confidence: Math.min(0.95, 0.4 + n * 0.1),
      evidence: [`median of ${n} texts read to the end`],
    });
  }

  private updateStyle() {
    const texts = [...this.verdicts.values()].filter((v) => v.textual);
    const n = texts.length;
    if (n < C.styleMinVerdicts) return;
    const low = texts.filter((v) => ENGAGEMENT_RANK[v.engagement] <= 1).length / n;
    const high = texts.filter((v) => ENGAGEMENT_RANK[v.engagement] >= 3).length / n;
    const style: ReadingStyle = low >= 0.6 ? 'skimmer' : high >= 0.4 ? 'deep-reader' : 'reader';
    const share = style === 'skimmer' ? low : style === 'deep-reader' ? high : 1 - low - high;
    const confidence = Math.min(0.95, share * Math.min(1, n / 8));
    const changed = style !== this.announcedStyle;
    this.style = { style, confidence, basis: n };
    this.dirty = true;
    if (!changed || confidence < C.styleAnnounceConfidence) return;
    this.announcedStyle = style;
    const text = { skimmer: 'skims most texts', reader: 'reads texts at a normal pace', 'deep-reader': 'dwells on many texts' }[style];
    this.add({
      kind: 'reading-style',
      scope: 'session',
      message: `Reading style: ${style.replace('-', ' ')}, ${text}`,
      confidence,
      evidence: [`${Math.round(low * 100)}% skipped/skimmed, ${Math.round(high * 100)}% dwelled`, `${n} texts judged`],
    });
  }

  // ---- bookkeeping -----------------------------------------------------------

  private add(i: NewInsight) {
    const insight: Insight = { ...i, id: this.nextId++, t: Math.round(i.t ?? this.tracker.getSnapshot().session.elapsedMs) };
    this.history.push(insight);
    this.dirty = true;
    this.insights.emit(insight);
  }

  private buildState(): InsightState {
    const s = this.tracker.getSnapshot().session;
    return {
      verdicts: Object.fromEntries(this.verdicts),
      profile: {
        readingStyle: this.style.style,
        styleConfidence: this.style.confidence,
        styleBasis: this.style.basis,
        paceWpm: s.readingPaceWpm,
        pointerFollowsReading: this.pointerDecision,
        scrollTempo: this.tempo,
      },
      insights: [...this.history],
    };
  }
}

function labelOf(snap: SignalSnapshot, unitId: string) {
  return snap.units.find((u) => u.unitId === unitId)?.label ?? unitId;
}

function duration(ms: number) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}
