import { describe, expect, it } from 'vitest';
import { concludeRun } from '../src/conclusions/conclude';
import type { SignalSnapshot } from '../src/signals/types';
import type { Engagement, InsightState, UnitVerdict } from '../src/insights/types';

function signals(activeMs = 120_000): SignalSnapshot {
  return {
    session: {
      activeMs,
      visible: true,
      idle: false,
      msSinceActivity: 1000,
      focusUnitId: 'x',
      readingPaceWpm: null,
      paceSamples: 0,
      navJumps: 0,
      scroll: { backscrolls: 0 },
      context: { coarsePointer: false },
    },
    units: [],
    works: [],
    events: [],
    focus: null,
  } as unknown as SignalSnapshot;
}

function insights(engagements: Engagement[], kind: 'text' | 'work' = 'text'): InsightState {
  const verdicts: Record<string, UnitVerdict> = {};
  engagements.forEach((engagement, i) => {
    verdicts[`u${i}`] = { unitId: `u${i}`, chapterId: 'c', kind, textual: true, label: `U${i}`, at: i, engagement, confidence: 0.9, ratio: 1, evidence: [] };
  });
  return {
    verdicts,
    insights: [],
    profile: { readingStyle: null, styleConfidence: 0, styleBasis: 0, paceWpm: null, pointerFollowsReading: null, scrollTempo: 'normal' },
  };
}

const item = (r: ReturnType<typeof concludeRun>, id: string) => r.items.find((c) => c.id === id)!;

describe('concludeRun', () => {
  it('concludes a short text need from mostly skimmed texts and settles on it', () => {
    const r = concludeRun(signals(), insights(['skimmed', 'skimmed', 'skipped', 'skimmed', 'read', 'skimmed', 'skimmed', 'skipped']), null, false);
    expect(item(r, 'textNeed').value).toBe('short');
    expect(item(r, 'textNeed').settled).toBe(true);
    expect(r.wouldDo).toContain('suggest shorter texts at next chapter');
  });

  it('does not settle on thin evidence', () => {
    const r = concludeRun(signals(), insights(['skimmed']), null, false);
    expect(item(r, 'textNeed').settled).toBe(false);
  });

  it('stays settled while the value holds even if confidence dips (hysteresis)', () => {
    const strong = concludeRun(signals(), insights(['read', 'read', 'read', 'read', 'read', 'read', 'read', 'read']), null, false);
    expect(item(strong, 'textNeed').settled).toBe(true);
    // Mixed evidence: still "standard" but less sure.
    const mixed = concludeRun(signals(), insights(['skipped', 'intense', 'read', 'skipped', 'intense', 'read', 'skimmed', 'lingered']), strong, false);
    const fresh = concludeRun(signals(), insights(['skipped', 'intense', 'read', 'skipped', 'intense', 'read', 'skimmed', 'lingered']), null, false);
    expect(item(mixed, 'textNeed').value).toBe('standard');
    expect(item(fresh, 'textNeed').confidence).toBeLessThan(0.7);
    expect(item(mixed, 'textNeed').settled).toBe(true);
    expect(item(fresh, 'textNeed').settled).toBe(false);
  });

  it('does not adapt before calibration', () => {
    const r = concludeRun(signals(10_000), insights(['skimmed', 'skimmed', 'skimmed', 'skimmed', 'skimmed', 'skimmed']), null, false);
    expect(r.calibrated).toBe(false);
    expect(r.wouldDo).toEqual(['calibrating, no adaptation yet']);
  });

  it('waits for tags before building an interest profile', () => {
    expect(item(concludeRun(signals(), insights([]), null, false), 'interests').waiting).toBe('needs tags');
  });
  it('raises context when section texts get unfolded', () => {
    const skimmed = insights(['skimmed', 'skimmed', 'skimmed', 'skimmed', 'skimmed', 'skimmed']);
    expect(item(concludeRun(signals(), skimmed, null, false), 'context').value).toBe('low');
    const unfolded = signals();
    const parts = { image: 0, caption: 0, text: 0, other: 0 };
    unfolded.units = [{ unitId: 's/text', kind: 'text', words: 80, visits: 1, returns: 0, idleStarts: 0, order: 0, bandMs: 1, textProgress: 1, hoverMs: parts, clicks: parts, opens: 0, expands: 3 }] as unknown as SignalSnapshot['units'];
    expect(item(concludeRun(unfolded, skimmed, null, false), 'context').value).toBe('medium');
  });
});
