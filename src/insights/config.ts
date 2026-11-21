import type { Engagement } from './types';

/** Thresholds of the interpretation rules. All ratios are dwell ÷ expected dwell. */
export const insightConfig = {
  /** Units with at least this many words are judged as text, others as images. */
  minTextWords: 15,
  /** Ratio boundaries between the text engagement levels. */
  textBounds: [0.1, 0.45, 1.3, 2.5],
  textLevels: ['skipped', 'skimmed', 'read', 'lingered', 'intense'] as Engagement[],
  /** Ratio boundaries between the image engagement levels. */
  imageBounds: [0.25, 0.7, 2.0],
  imageLevels: ['skipped', 'glanced', 'looked', 'intense'] as Engagement[],
  /** How quickly confidence rises with distance from a boundary (in log-ratio units). */
  boundarySoftness: 0.25,

  /** Pointer time on an image that counts as looking at it intensely. */
  intenseImageHoverMs: 4000,

  /** A unit is judged once it has been out of focus this long (avoids judging pointer sweeps). */
  settleMs: 2500,
  /** Units passed with less band time than this were skipped completely. */
  completelySkippedMaxBandMs: 300,

  /** Scroll tempo vs the visitor's baseline (recent ~3 s), with hysteresis. */
  fastEnter: 1.8,
  fastExit: 1.3,
  slowEnter: 0.5,
  slowExit: 0.75,

  /** Pointer reliability is decided after this much session time. */
  pointerDecisionAfterMs: 60_000,
  pointerReliableShare: 0.6,
  pointerUnreliableShare: 0.3,

  /** Report the reading pace every this many new samples. */
  paceEvery: 3,
  /** Reading style needs at least this many text verdicts. */
  styleMinVerdicts: 4,
  /** A new reading style is only announced once the engine is this sure. */
  styleAnnounceConfidence: 0.45,
};
