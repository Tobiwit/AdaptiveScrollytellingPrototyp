import type { UnitKind } from '../signals/types';

// text: skipped → skimmed → read → lingered → intense
// image: skipped → glanced → looked → intense
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
  /** 0–1 */
  confidence: number;
  /** dwell / expected */
  ratio: number;
  /** reasons, shown in the debug view */
  evidence: string[];
}

export interface UnitVerdict extends Judgement {
  unitId: string;
  workId?: string;
  chapterId: string;
  kind: UnitKind;
  /** judged as text (enough words), not as image */
  textual: boolean;
  label: string;
  /** ms since session start. */
  at: number;
  /** passed without ever being in focus, not from judgeUnit() */
  passed?: true;
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
  | 'reading-style'
  | 'image-opened'
  | 'text-expanded';

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

export interface VisitorProfile {
  readingStyle: ReadingStyle | null;
  styleConfidence: number;
  /** text verdicts it's based on */
  styleBasis: number;
  paceWpm: number | null;
  /** null = not known yet */
  pointerFollowsReading: boolean | null;
  scrollTempo: 'normal' | 'fast' | 'slow';
}

export interface InsightState {
  verdicts: Record<string, UnitVerdict>;
  profile: VisitorProfile;
  insights: Insight[];
}
