import type { WorkSize } from '../schema/schema';

/** A work as shown in a section, or a section's own text. */
export type UnitKind = 'work' | 'text';

/** From data-part attributes. */
export type Part = 'image' | 'caption' | 'text' | 'other';
export const PARTS: Part[] = ['image', 'caption', 'text', 'other'];

export interface UnitMeta {
  unitId: string;
  kind: UnitKind;
  chapterId: string;
  sectionId: string;
  workId?: string;
  label: string;
  words: number;
  hasImage: boolean;
  size?: WorkSize;
}

export type PartRecord = Record<Part, number>;

/** Times are ms since session start. */
export interface UnitSnapshot extends UnitMeta {
  order: number;
  /** image time + words at the default wpm */
  expectedMs: number;
  /** same at the visitor's own pace, once known */
  expectedPersonalMs: number | null;
  /** in focus while active */
  dwellMs: number;
  /** dwell / expected */
  readingRatio: number;
  /** anywhere in the band, focused or not */
  bandMs: number;
  visits: number;
  currentVisitMs: number;
  returns: number;
  /** scroll-backs that started here */
  leftBackward: number;
  /** first visit way shorter than expected */
  skips: number;
  /** 0–1, how far the reading line got */
  textProgress: number;
  /** vh/s while moving */
  avgSpeed: number | null;
  /** avgSpeed / session baseline */
  relSpeed: number | null;
  movingShare: number | null;
  /** only counted while the pointer moves */
  hoverMs: PartRecord;
  hoverEntries: PartRecord;
  clicks: PartRecord;
  idleStarts: number;
  /** full-screen image views */
  opens: number;
  openMs: number;
  /** "more" / "read text" opened */
  expands: number;
  firstFocusAt: number | null;
  lastFocusAt: number | null;
}

/** Summed over all units of a work. */
export interface WorkSnapshot {
  workId: string;
  label: string;
  unitIds: string[];
  dwellMs: number;
  expectedMs: number;
  readingRatio: number;
  bandMs: number;
  visits: number;
  returns: number;
  imageHoverMs: number;
  clicks: number;
}

export interface SessionSnapshot {
  startedAt: string;
  elapsedMs: number;
  activeMs: number;
  idleMs: number;
  hiddenMs: number;
  visible: boolean;
  /** can be visible but unfocused, e.g. second screen */
  windowFocused: boolean;
  idle: boolean;
  /** dwell only counts while active */
  active: boolean;
  msSinceActivity: number;
  idleThresholdMs: number;
  /** pointer unit while it moves, else the band focus */
  focusUnitId: string | null;
  /** ignoring the pointer */
  bandFocusUnitId: string | null;
  scroll: {
    y: number;
    /** smoothed, negative = up */
    velocity: number;
    speed: number;
    /** moving speed, nav jumps excluded */
    baseline: number | null;
    baselineStd: number | null;
    relSpeed: number | null;
    /** last ~3 s vs baseline */
    recentRelSpeed: number | null;
    distanceVh: number;
    backscrolls: number;
    backscrollVh: number;
    navigating: boolean;
  };
  pointer: {
    type: string | null;
    inside: boolean;
    engaged: boolean;
    unitId: string | null;
    part: Part | null;
    /** does the mouse follow the reading? */
    onFocusShare: number | null;
  };
  clicks: number;
  navJumps: number;
  /** median over fully read units */
  readingPaceWpm: number | null;
  paceSamples: number;
  context: {
    viewport: [number, number];
    devicePixelRatio: number;
    coarsePointer: boolean;
    reducedMotion: boolean;
    language: string;
  };
}

export type SignalEvent = { t: number } & (
  | { type: 'focus-enter'; unitId: string; workId?: string; sectionId: string }
  | { type: 'focus-exit'; unitId: string; workId?: string; sectionId: string; visitMs: number }
  | { type: 'skip'; unitId: string; visitMs: number; expectedMs: number }
  | { type: 'backscroll'; distanceVh: number; fromUnitId: string | null; toUnitId: string | null }
  | { type: 'idle-start'; unitId: string | null; afterMs: number }
  | { type: 'idle-end'; idleMs: number }
  | { type: 'visibility'; visible: boolean }
  | { type: 'window-focus'; focused: boolean }
  | { type: 'hover'; unitId: string; part: Part; ms: number }
  | { type: 'click'; unitId: string | null; part: Part | null; target: string }
  | { type: 'nav-jump'; href: string }
  | { type: 'image-open'; unitId: string; workId?: string }
  | { type: 'image-close'; unitId: string; ms: number }
  | { type: 'expand'; unitId: string; open: boolean }
);

export interface SignalSnapshot {
  session: SessionSnapshot;
  focus: UnitSnapshot | null;
  units: UnitSnapshot[];
  works: WorkSnapshot[];
  /** newest last */
  events: SignalEvent[];
}
