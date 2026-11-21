import type { UnitKind } from '../signals/types';

/**
 * How a visitor engaged with one unit, from least to most.
 * Text units use skipped → skimmed → read → lingered → intense,
 * image-only units use skipped → glanced → looked → intense.
 */
export type Engagement = 'skipped' | 'glanced' | 'skimmed' | 'read' | 'looked' | 'lingered' | 'intense';

export const ENGAGEMENT_RANK: Record<Engagement, number> = {
  skipped: 0,
  glanced: 1,
  skimmed: 1,
  read: 2,
  looked: 2,
  lingered: 3,
  intense: 4,
};

export interface Judgement {
  engagement: Engagement;
  /** 0–1: how sure the rules are about this verdict. */
  confidence: number;
  /** dwell ÷ expected dwell. */
  ratio: number;
  /** Human-readable reasons, for the debug view and later for the thesis. */
  evidence: string[];
}

export interface UnitVerdict extends Judgement {
  unitId: string;
  workId?: string;
  chapterId: string;
  kind: UnitKind;
  /** Judged as text (enough words) rather than as an image. */
  textual: boolean;
  label: string;
  /** ms since session start. */
  at: number;
}

export type InsightKind =
  | 'unit-verdict'
  | 'skipped-completely'
  | 'went-back'
  | 'image-intense'
  | 'inactive'
  | 'active-again'
  | 'left-tab'
  | 'returned-tab'
  | 'window-blur'
  | 'speed-up'
  | 'slow-down'
  | 'speed-normal'
  | 'pointer-reliable'
  | 'pointer-unreliable'
  | 'reading-pace'
  | 'chapter-summary'
  | 'reading-style';

/** One abstracted conclusion drawn from the raw signals. */
export interface Insight {
  id: number;
  /** ms since session start. */
  t: number;
  kind: InsightKind;
  scope: 'unit' | 'chapter' | 'session';
  message: string;
  confidence: number;
  evidence: string[];
  unitId?: string;
  workId?: string;
  chapterId?: string;
  engagement?: Engagement;
}

export type ReadingStyle = 'skimmer' | 'reader' | 'deep-reader';

/** What we currently believe about the visitor as a whole. */
export interface VisitorProfile {
  readingStyle: ReadingStyle | null;
  styleConfidence: number;
  /** Number of text verdicts the style is based on. */
  styleBasis: number;
  paceWpm: number | null;
  /** Whether the pointer is a usable gaze proxy for this visitor (null = not known yet). */
  pointerFollowsReading: boolean | null;
  scrollTempo: 'normal' | 'fast' | 'slow';
}

export interface InsightState {
  verdicts: Record<string, UnitVerdict>;
  profile: VisitorProfile;
  insights: Insight[];
}
