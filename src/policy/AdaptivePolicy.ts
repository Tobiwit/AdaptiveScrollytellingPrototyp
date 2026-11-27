import { BASELINE, type Adaptation, type Step } from '../adaptation/AdaptationContext';
import type { Conclusion, RunConclusions } from '../conclusions/conclude';
import type { PresentationPolicy, WorkPresentation } from '../presentation/policy';
import type { Exhibition, WorkSize } from '../schema/schema';
import { createEventBus } from '../signals/bus';
import { CONCLUSION_VALUES, policyConfig as P, type Dimension } from './config';

export type Steps = Adaptation & { size: Step };
export type PolicyMode = 'auto' | 'suggest';

export interface Change {
  dimension: Dimension;
  from: Step;
  to: Step;
}

export interface Decision extends Change {
  id: number;
  /** first chapter it applies to */
  chapterId: string | null;
  message: string;
  confidence: number;
  evidence: string[];
  via: 'auto' | 'accepted' | 'undo';
}

export type SuggestionStatus = 'offered' | 'accepted' | 'declined' | 'ignored' | 'undone';

export interface Suggestion {
  id: number;
  /** shown at the start of this chapter, applies from there on */
  chapterId: string;
  changes: Change[];
  /** conclusion that triggered it */
  because: { id: string; label: string; value: string; confidence: number };
  status: SuggestionStatus;
}

export interface SuggestionEvent {
  status: SuggestionStatus;
  suggestion: Suggestion;
}

export const DIMENSIONS: Dimension[] = ['length', 'depth', 'size', 'presence'];
export const STEP_LABELS: Record<Dimension, [string, string, string]> = {
  length: ['short', 'standard', 'long'],
  depth: ['hidden', 'standard', 'deep'],
  size: ['S', 'M', 'L'],
  presence: ['supporting', 'standard', 'leading'],
};
const SIZES: WorkSize[] = ['S', 'M', 'L'];
const MESSAGES: Record<Dimension, [string, string]> = {
  length: ['Shorter texts', 'Longer texts'],
  depth: ['Less background', 'More background'],
  size: ['Smaller images', 'Larger images'],
  presence: ['Images step back', 'Images take the lead'],
};

/**
 * Turns settled run conclusions into steps, decided whenever the visitor enters a new chapter.
 * Chapters already reached keep their steps, so nothing on screen changes; new steps apply ahead.
 * In suggest mode a change is only offered (one at a time) and applied once accepted.
 */
export class AdaptivePolicy implements PresentationPolicy {
  readonly decisions = createEventBus<Decision>();
  readonly suggestionEvents = createEventBus<SuggestionEvent>();
  private listeners = new Set<() => void>();
  private frozen = new Map<string, Steps>();
  private planned: Steps = { ...BASELINE, size: 1 };
  private reached = -1;
  private nextId = 1;
  private suggestions: Suggestion[] = [];
  private cooldownUntil: Partial<Record<Dimension, number>> = {};
  private version = 0;
  log: Decision[] = [];
  status = 'waiting';

  constructor(
    private readonly chapters: string[],
    private readonly workChapter: Map<string, string>,
    private readonly defaults: Omit<WorkPresentation, 'size'>,
    readonly mode: PolicyMode = 'auto',
  ) {}

  static for(exhibition: Exhibition, mode: PolicyMode = 'auto') {
    const workChapter = new Map<string, string>();
    for (const c of exhibition.chapters) for (const s of c.sections) for (const w of s.works) if (!workChapter.has(w)) workChapter.set(w, c.id);
    return new AdaptivePolicy(
      exhibition.chapters.map((c) => c.id),
      workChapter,
      exhibition.defaults,
      mode,
    );
  }

  stepsFor(chapterId: string): Steps {
    return this.frozen.get(chapterId) ?? this.planned;
  }

  getPlanned(): Steps {
    return this.planned;
  }

  getVersion = () => this.version;

  suggestionFor(chapterId: string): Suggestion | null {
    return [...this.suggestions].reverse().find((s) => s.chapterId === chapterId) ?? null;
  }

  getWorkPresentation(workId: string): WorkPresentation {
    const chapter = this.workChapter.get(workId);
    return { size: SIZES[chapter ? this.stepsFor(chapter).size : 1], textVariant: this.defaults.textVariant };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  reset() {
    this.frozen.clear();
    this.planned = { ...BASELINE, size: 1 };
    this.reached = -1;
    this.log = [];
    this.suggestions = [];
    this.cooldownUntil = {};
    this.status = 'waiting';
    this.notify();
  }

  /** Call regularly; only acts when the reading band reaches a chapter for the first time. */
  update(run: RunConclusions, chapterId: string | null) {
    const idx = chapterId ? this.chapters.indexOf(chapterId) : -1;
    if (idx <= this.reached) return;
    for (let i = this.reached + 1; i <= idx; i++) this.frozen.set(this.chapters[i], { ...this.planned });
    this.reached = idx;

    for (const s of this.suggestions) {
      if (s.status === 'offered' && this.chapters.indexOf(s.chapterId) <= idx) this.answer(s, 'ignored');
    }

    if (P.requireCalibration && !run.calibrated) {
      this.status = 'calibrating';
      this.notify();
      return;
    }
    this.status = 'adapting';
    const next = this.chapters[idx + 1] ?? null;
    const wanted = this.candidates(run);
    if (this.mode === 'auto') {
      for (const { change, c } of wanted) this.apply(change, next, c, 'auto');
    } else if (next) {
      this.suggest(wanted, next, idx);
    }
    this.notify();
  }

  accept(id: number) {
    const s = this.suggestions.find((x) => x.id === id);
    if (!s || (s.status !== 'offered' && s.status !== 'ignored')) return;
    for (const ch of s.changes) {
      this.apply({ ...ch, from: this.planned[ch.dimension] }, s.chapterId, s.because, 'accepted');
      this.refreeze(s.chapterId, ch.dimension, ch.to);
    }
    this.answer(s, 'accepted');
    this.notify();
  }

  decline(id: number) {
    const s = this.suggestions.find((x) => x.id === id);
    if (!s || (s.status !== 'offered' && s.status !== 'ignored')) return;
    this.answer(s, 'declined');
    this.notify();
  }

  undo(id: number) {
    const s = this.suggestions.find((x) => x.id === id);
    if (!s || s.status !== 'accepted') return;
    for (const ch of s.changes) {
      this.apply({ dimension: ch.dimension, from: this.planned[ch.dimension], to: ch.from }, s.chapterId, s.because, 'undo');
      this.refreeze(s.chapterId, ch.dimension, ch.from);
    }
    this.answer(s, 'undone');
    this.notify();
  }

  // the card sits at the top of its chapter, so everything from there on is below the visitor
  private refreeze(chapterId: string, dim: Dimension, step: Step) {
    const from = this.chapters.indexOf(chapterId);
    for (const [id, steps] of this.frozen) {
      if (this.chapters.indexOf(id) >= from) this.frozen.set(id, { ...steps, [dim]: step });
    }
  }

  private candidates(run: RunConclusions) {
    const out: { change: Change; c: Pick<Conclusion, 'id' | 'label' | 'value' | 'confidence'> }[] = [];
    for (const dim of DIMENSIONS) {
      const rule = P.rules[dim];
      if (!rule.enabled) continue;
      const c = run.items.find((i) => i.id === rule.from);
      if (!c?.settled || c.confidence < P.minConfidence) continue;
      const target = CONCLUSION_VALUES[rule.from]?.indexOf(c.value) ?? -1;
      const from = this.planned[dim];
      if (target < 0 || target === from) continue;
      const max = Math.max(1, P.maxStepPerChapter);
      const to = (from + Math.max(-max, Math.min(max, target - from))) as Step;
      out.push({ change: { dimension: dim, from, to }, c });
    }
    return out;
  }

  /** One question at a time; changes driven by the same conclusion in the same direction go together. */
  private suggest(wanted: ReturnType<AdaptivePolicy['candidates']>, next: string, idx: number) {
    if (this.suggestions.some((s) => s.status === 'offered')) return;
    const open = wanted.filter(({ change }) => (this.cooldownUntil[change.dimension] ?? -1) < idx);
    if (!open.length) return;
    const best = open.reduce((a, b) => (b.c.confidence > a.c.confidence ? b : a));
    const up = best.change.to > best.change.from;
    const group = open.filter(({ change, c }) => c.id === best.c.id && change.to > change.from === up);
    const s: Suggestion = {
      id: this.nextId++,
      chapterId: next,
      changes: group.map((g) => g.change),
      because: { id: best.c.id, label: best.c.label, value: best.c.value, confidence: best.c.confidence },
      status: 'offered',
    };
    this.suggestions.push(s);
    this.suggestionEvents.emit({ status: 'offered', suggestion: { ...s } });
  }

  private answer(s: Suggestion, status: SuggestionStatus) {
    s.status = status;
    if (status === 'declined' || status === 'ignored' || status === 'undone') {
      for (const ch of s.changes) this.cooldownUntil[ch.dimension] = this.reached + P.suggestCooldownChapters;
    }
    this.suggestionEvents.emit({ status, suggestion: { ...s } });
  }

  private apply(change: Change, chapterId: string | null, c: Pick<Conclusion, 'label' | 'value' | 'confidence'>, via: Decision['via']) {
    const { dimension: dim, from, to } = change;
    if (from === to) return;
    this.planned = { ...this.planned, [dim]: to };
    const d: Decision = {
      id: this.nextId++,
      dimension: dim,
      from,
      to,
      chapterId,
      via,
      message: `${MESSAGES[dim][to > from ? 1 : 0]} from the next chapter`,
      confidence: c.confidence,
      evidence: [`${c.label}: ${c.value} (${Math.round(c.confidence * 100)}%, settled)`, `${dim} ${STEP_LABELS[dim][from]} → ${STEP_LABELS[dim][to]}`, ...(via === 'auto' ? [] : [via])],
    };
    this.log.push(d);
    this.decisions.emit(d);
  }

  private notify() {
    this.version++;
    for (const l of this.listeners) l();
  }
}
