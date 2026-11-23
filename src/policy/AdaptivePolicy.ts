import { BASELINE, type Adaptation, type Step } from '../adaptation/AdaptationContext';
import type { RunConclusions } from '../conclusions/conclude';
import type { PresentationPolicy, WorkPresentation } from '../presentation/policy';
import type { Exhibition, WorkSize } from '../schema/schema';
import { createEventBus } from '../signals/bus';
import { CONCLUSION_VALUES, policyConfig as P, type Dimension } from './config';

export type Steps = Adaptation & { size: Step };

export interface Decision {
  id: number;
  dimension: Dimension;
  from: Step;
  to: Step;
  /** first chapter it applies to */
  chapterId: string | null;
  message: string;
  confidence: number;
  evidence: string[];
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
 */
export class AdaptivePolicy implements PresentationPolicy {
  readonly decisions = createEventBus<Decision>();
  private listeners = new Set<() => void>();
  private frozen = new Map<string, Steps>();
  private planned: Steps = { ...BASELINE, size: 1 };
  private reached = -1;
  private nextId = 1;
  log: Decision[] = [];
  status = 'waiting';

  constructor(
    private readonly chapters: string[],
    private readonly workChapter: Map<string, string>,
    private readonly defaults: Omit<WorkPresentation, 'size'>,
  ) {}

  static for(exhibition: Exhibition) {
    const workChapter = new Map<string, string>();
    for (const c of exhibition.chapters) for (const s of c.sections) for (const w of s.works) if (!workChapter.has(w)) workChapter.set(w, c.id);
    return new AdaptivePolicy(
      exhibition.chapters.map((c) => c.id),
      workChapter,
      exhibition.defaults,
    );
  }

  stepsFor(chapterId: string): Steps {
    return this.frozen.get(chapterId) ?? this.planned;
  }

  getPlanned(): Steps {
    return this.planned;
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
    this.status = 'waiting';
    this.notify();
  }

  /** Call regularly; only acts when the reading band reaches a chapter for the first time. */
  update(run: RunConclusions, chapterId: string | null) {
    const idx = chapterId ? this.chapters.indexOf(chapterId) : -1;
    if (idx <= this.reached) return;
    for (let i = this.reached + 1; i <= idx; i++) this.frozen.set(this.chapters[i], { ...this.planned });
    this.reached = idx;

    if (P.requireCalibration && !run.calibrated) {
      this.status = 'calibrating';
      this.notify();
      return;
    }
    this.status = 'adapting';
    const next = this.chapters[idx + 1] ?? null;
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
      this.planned = { ...this.planned, [dim]: to };
      const d: Decision = {
        id: this.nextId++,
        dimension: dim,
        from,
        to,
        chapterId: next,
        message: `${MESSAGES[dim][to > from ? 1 : 0]} from the next chapter`,
        confidence: c.confidence,
        evidence: [`${c.label}: ${c.value} (${Math.round(c.confidence * 100)}%, settled)`, `${dim} ${STEP_LABELS[dim][from]} → ${STEP_LABELS[dim][to]}`],
      };
      this.log.push(d);
      this.decisions.emit(d);
    }
    this.notify();
  }

  private notify() {
    for (const l of this.listeners) l();
  }
}
