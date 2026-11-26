export const conclusionConfig = {
  score: { skipped: -1, glanced: -0.5, skimmed: -0.5, read: 0, looked: 0, lingered: 0.5, intense: 1 },
  halfLife: 6, // weight halves every N verdicts
  settle: 0.7,
  unsettle: 0.55, // stays settled down to this while the value holds
  calibration: { verdicts: 6, activeMs: 60_000 },

  // value cut-offs on the -1…1 scores
  // *Weight: added per click on "Read text" / "More" / a full-screen image, up to +0.5
  textNeed: { short: -0.33, long: 0.33, expandWeight: 0.15 },
  context: { low: -0.33, lowVsWorks: -0.4, high: 0.1, highVsWorks: -0.1, expandWeight: 0.15 },
  visual: { textLed: -0.25, imageLed: 0.25, pointerWeight: 0.5, openWeight: 0.15 },
  trend: { falling: -0.25, rising: 0.25 },
};
