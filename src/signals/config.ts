import type { WorkSize } from '../schema/schema';

/**
 * All thresholds of the signal tracker in one place.
 * Speeds are in viewport heights per second (vh/s) so they compare across screens.
 */
export const signalConfig = {
  /** How often the tracker samples scroll position, focus and dwell. */
  tickMs: 250,

  /** Default on-screen reading speed used for the expected dwell time. */
  readingWpm: 200,
  /** Time a visitor is expected to look at an image, by presented size. */
  imageMs: { S: 2000, M: 3000, L: 4000 } satisfies Record<WorkSize, number>,

  /** Vertical band of the viewport (fractions) in which a unit counts as "in focus". */
  band: [0.3, 0.7] as const,
  /** Reading line (fraction of viewport height) used for text progress. */
  readingLine: 0.5,

  /** No input for this long → inactive. Raised to 1.5× the focused unit's expected dwell. */
  idleMinMs: 30_000,
  idleExpectedFactor: 1.5,

  /** Below this speed the page counts as standing still. */
  movingVhPerS: 0.02,
  /** Time constant of the "recent" scroll speed average. */
  recentTauMs: 3000,

  /** An upward scroll of at least this many viewport heights is a scroll-back. */
  backscrollMinVh: 0.3,
  /** A scroll-back ends after this long without upward movement. */
  backscrollEndMs: 1200,

  /** After a click on an in-page link, scrolling is navigation, not reading behaviour. */
  navLockMs: 1500,

  /** The pointer counts as "engaged" (a gaze proxy) for this long after it last moved. */
  pointerEngagedMs: 3000,
  /** Hovers shorter than this are not logged as events. */
  hoverMinMs: 300,

  /** A first visit shorter than this share of the expected dwell is a skip. */
  skipRatio: 0.2,
  skipMinExpectedMs: 3000,

  /** Reading pace is only estimated from units with enough text that were read to the end. */
  paceMinWords: 20,
  paceMinProgress: 0.8,
  paceRangeWpm: [50, 800] as const,

  eventLogSize: 80,
};
