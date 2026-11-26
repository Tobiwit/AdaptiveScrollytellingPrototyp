import type { Engagement } from './types';

// Ratios are dwell / expected dwell.
export const insightConfig = {
  minTextWords: 15, // fewer words → judged as an image
  textBounds: [0.1, 0.45, 1.3, 2.5],
  textLevels: ['skipped', 'skimmed', 'read', 'lingered', 'intense'] as Engagement[],
  imageBounds: [0.25, 0.7, 2.0],
  imageLevels: ['skipped', 'glanced', 'looked', 'intense'] as Engagement[],
  boundarySoftness: 0.25, // log-ratio units

  intenseImageHoverMs: 4000,
  intenseOpenMs: 1500, // full-screen view
  openNoticeMs: 800,

  settleMs: 2500, // wait after focus leaves, so pointer sweeps don't count
  completelySkippedMaxBandMs: 300,

  // scroll tempo vs baseline, with hysteresis
  fastEnter: 1.8,
  fastExit: 1.3,
  slowEnter: 0.5,
  slowExit: 0.75,

  pointerDecisionAfterMs: 60_000,
  pointerReliableShare: 0.6,
  pointerUnreliableShare: 0.3,

  paceEvery: 3,
  styleMinVerdicts: 4,
  styleAnnounceConfidence: 0.45,
};
