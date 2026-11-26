import { describe, expect, it } from 'vitest';
import { judgeUnit } from '../src/insights/judge';
import type { UnitSnapshot } from '../src/signals/types';

const parts = () => ({ image: 0, caption: 0, text: 0, other: 0 });

/** A text unit of 100 words: expected 30 s at 200 wpm. */
function unit(over: Partial<UnitSnapshot> = {}): UnitSnapshot {
  return {
    unitId: 's/text',
    kind: 'text',
    chapterId: 'c',
    sectionId: 's',
    label: 'Test',
    words: 100,
    hasImage: false,
    order: 0,
    expectedMs: 30_000,
    expectedPersonalMs: null,
    dwellMs: 30_000,
    readingRatio: 1,
    bandMs: 30_000,
    visits: 1,
    currentVisitMs: 0,
    returns: 0,
    leftBackward: 0,
    skips: 0,
    textProgress: 1,
    avgSpeed: null,
    relSpeed: null,
    movingShare: null,
    hoverMs: parts(),
    hoverEntries: parts(),
    clicks: parts(),
    idleStarts: 0,
    opens: 0,
    openMs: 0,
    expands: 0,
    firstFocusAt: 0,
    lastFocusAt: 0,
    ...over,
  };
}

describe('judgeUnit', () => {
  it('reads a unit dwelled on for about the expected time as "read"', () => {
    expect(judgeUnit(unit()).engagement).toBe('read');
  });

  it('classifies by dwell ratio', () => {
    expect(judgeUnit(unit({ dwellMs: 1_000, textProgress: 0.1 })).engagement).toBe('skipped');
    expect(judgeUnit(unit({ dwellMs: 8_000 })).engagement).toBe('skimmed');
    expect(judgeUnit(unit({ dwellMs: 50_000 })).engagement).toBe('lingered');
    expect(judgeUnit(unit({ dwellMs: 90_000 })).engagement).toBe('intense');
  });

  it('is surer far from a boundary than right on it', () => {
    const onBoundary = judgeUnit(unit({ dwellMs: 0.45 * 30_000 })).confidence;
    const clear = judgeUnit(unit({ dwellMs: 1_000, textProgress: 0.1 })).confidence;
    expect(onBoundary).toBeLessThan(0.6);
    expect(clear).toBeGreaterThan(0.9);
  });

  it('trusts "skimmed" more when the visitor also scrolled fast', () => {
    const plain = judgeUnit(unit({ dwellMs: 8_000 })).confidence;
    const fast = judgeUnit(unit({ dwellMs: 8_000, relSpeed: 2 })).confidence;
    const slow = judgeUnit(unit({ dwellMs: 8_000, relSpeed: 0.5 })).confidence;
    expect(fast).toBeGreaterThan(plain);
    expect(slow).toBeLessThan(plain);
  });

  it('doubts long dwell that includes inactivity', () => {
    const plain = judgeUnit(unit({ dwellMs: 50_000 })).confidence;
    const idle = judgeUnit(unit({ dwellMs: 50_000, idleStarts: 1 })).confidence;
    expect(idle).toBeLessThan(plain);
  });

  it('judges image-only units on their own scale and upgrades long pointer time to intense', () => {
    const img = { words: 0, hasImage: true, kind: 'work' as const, expectedMs: 3_000 };
    expect(judgeUnit(unit({ ...img, dwellMs: 1_500 })).engagement).toBe('glanced');
    expect(judgeUnit(unit({ ...img, dwellMs: 3_000 })).engagement).toBe('looked');
    const hover = { ...parts(), image: 5_000 };
    expect(judgeUnit(unit({ ...img, dwellMs: 3_000, hoverMs: hover })).engagement).toBe('intense');
  });

  it('uses the personal reading pace when known', () => {
    // 30 s dwell is "read" at 200 wpm but "lingered" for someone whose personal expectation is 15 s.
    expect(judgeUnit(unit({ expectedPersonalMs: 15_000 })).engagement).toBe('lingered');
  });
  it('counts a long full-screen view as looking intensely', () => {
    const j = judgeUnit(unit({ kind: 'work', words: 0, hasImage: true, expectedMs: 3000, dwellMs: 2500, openMs: 2000, opens: 1 }));
    expect(j.engagement).toBe('intense');
  });
});
