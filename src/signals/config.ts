import type { WorkSize } from '../schema/schema';

// Speeds are in viewport heights per second, so they compare across screens.
export const signalConfig = {
  tickMs: 250,

  readingWpm: 200,
  imageMs: { S: 2000, M: 3000, L: 4000 } satisfies Record<WorkSize, number>,

  band: [0.3, 0.7] as const, // part of the viewport where a unit can be in focus
  readingLine: 0.5, // for text progress

  // idle after max(idleMinMs, factor × expected dwell of the focused unit)
  idleMinMs: 30_000,
  idleExpectedFactor: 1.5,

  movingVhPerS: 0.02,
  recentTauMs: 3000,

  backscrollMinVh: 0.3,
  backscrollEndMs: 1200,

  navLockMs: 1500, // scrolling right after a nav click isn't reading

  pointerEngagedMs: 3000,
  hoverMinMs: 300,

  skipRatio: 0.2,
  skipMinExpectedMs: 3000,

  // pace only from units read to the end, at reading (not skimming) speed
  paceMinWords: 20,
  paceMinProgress: 0.8,
  paceRangeWpm: [80, 450] as const,
  paceMaxRelSpeed: 1.5,

  eventLogSize: 80,
};
