import type { WorkSize } from '../schema/schema';

/**
 * A unit is one trackable piece of the exhibition:
 * a work as shown in a section (`work`), or a section's own text (`text`).
 */
export type UnitKind = 'work' | 'text';

/** Which part of a unit the pointer or a click is on (from `data-part` attributes). */
export type Part = 'image' | 'caption' | 'text' | 'other';
export const PARTS: Part[] = ['image', 'caption', 'text', 'other'];

export interface UnitMeta {
  unitId: string;
  kind: UnitKind;
  chapterId: string;
  sectionId: string;
  workId?: string;
  label: string;
  /** Words of text the visitor is shown in this unit (depends on the presented text variant). */
  words: number;
  hasImage: boolean;
  size?: WorkSize;
}

export type PartRecord = Record<Part, number>;

/** Everything measured for one unit. Times in ms since session start. */
export interface UnitSnapshot extends UnitMeta {
  /** Position in the document, top to bottom. */
  order: number;
  /** Expected dwell: image viewing time + words at the default reading speed. */
  expectedMs: number;
  /** Expected dwell at the visitor's own estimated reading pace (null until known). */
  expectedPersonalMs: number | null;
  /** Time as the focused unit while the visitor was active. */
  dwellMs: number;
  /** dwellMs / expectedMs. ~1 = read at the default pace, <<1 = skimmed, >1 = lingered. */
  readingRatio: number;
  /** Time anywhere in the focus band while active (also counts units next to the focused one). */
  bandMs: number;
  visits: number;
  currentVisitMs: number;
  /** Times the visitor scrolled back up to this unit. */
  returns: number;
  /** Times a scroll-back started while this unit was focused. */
  leftBackward: number;
  /** First visits much shorter than expected. */
  skips: number;
  /** How far the reading line got through the unit's text (0–1, maximum reached). */
  textProgress: number;
  /** Average scroll speed while focused and moving (vh/s). */
  avgSpeed: number | null;
  /** avgSpeed relative to the session's baseline scroll speed. */
  relSpeed: number | null;
  /** Share of focused time spent scrolling (vs standing still). */
  movingShare: number | null;
  /** Engaged pointer time per part (pointer moved within the last few seconds). */
  hoverMs: PartRecord;
  hoverEntries: PartRecord;
  clicks: PartRecord;
  idleStarts: number;
  firstFocusAt: number | null;
  lastFocusAt: number | null;
}

/** Unit stats added up per work (a work can appear in several sections). */
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
  /** Tab is visible. */
  visible: boolean;
  /** Browser window has focus (it can be visible but unfocused, e.g. on a second screen). */
  windowFocused: boolean;
  idle: boolean;
  /** Visible and not idle: dwell only accrues while this is true. */
  active: boolean;
  msSinceActivity: number;
  idleThresholdMs: number;
  /** Focused unit: a moving pointer's unit, otherwise the band focus. */
  focusUnitId: string | null;
  /** Focus from scroll position alone (the unit in the reading band). */
  bandFocusUnitId: string | null;
  scroll: {
    y: number;
    /** Signed velocity, smoothed (vh/s, negative = upwards). */
    velocity: number;
    /** Absolute speed right now, smoothed. */
    speed: number;
    /** Mean and spread of the session's scroll speed while moving (excluding navigation jumps). */
    baseline: number | null;
    baselineStd: number | null;
    /** Current speed relative to the baseline. */
    relSpeed: number | null;
    /** Moving speed of the last few seconds relative to the baseline: a change in behaviour. */
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
    /** Share of engaged pointer time spent on the focused unit: does this visitor's mouse follow their eyes? */
    onFocusShare: number | null;
  };
  clicks: number;
  navJumps: number;
  /** Visitor's reading pace estimated from fully read units (median). */
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

/** Notable moments, in order. `t` is ms since session start. */
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
);

export interface SignalSnapshot {
  session: SessionSnapshot;
  focus: UnitSnapshot | null;
  units: UnitSnapshot[];
  works: WorkSnapshot[];
  /** Most recent events, newest last. */
  events: SignalEvent[];
}
