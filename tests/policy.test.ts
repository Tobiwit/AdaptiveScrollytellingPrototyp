import { afterEach, describe, expect, it } from 'vitest';
import { AdaptivePolicy } from '../src/policy/AdaptivePolicy';
import { applyOverrides } from '../src/tuning/tuning';
import type { Conclusion, ConclusionId, RunConclusions } from '../src/conclusions/conclude';

const chapters = ['c1', 'c2', 'c3', 'c4'];
const policy = () => new AdaptivePolicy(chapters, new Map([['w4', 'c4']]), { textVariant: 'long' });

function run(values: Partial<Record<ConclusionId, string>>, calibrated = true, confidence = 0.9): RunConclusions {
  const items = Object.entries(values).map(
    ([id, value]) => ({ id, label: id, value, confidence, settled: true, meter: null, basis: 10, trend: null, evidence: [] }) as Conclusion,
  );
  return { items, workScores: {}, calibrated, wouldDo: [] };
}

afterEach(() => applyOverrides({}));

describe('AdaptivePolicy', () => {
  it('waits for calibration', () => {
    const p = policy();
    p.update(run({ textNeed: 'short' }, false), 'c1');
    expect(p.getPlanned().length).toBe(1);
    expect(p.status).toBe('calibrating');
  });

  it('adapts ahead and keeps chapters already reached', () => {
    const p = policy();
    const decisions: string[] = [];
    p.decisions.subscribe((d) => decisions.push(d.message));
    p.update(run({ textNeed: 'short', visual: 'image-led' }), 'c2');
    expect(p.stepsFor('c2').length).toBe(1);
    expect(p.stepsFor('c3').length).toBe(0);
    expect(p.stepsFor('c3').presence).toBe(2);
    expect(p.getWorkPresentation('w4').size).toBe('L');
    expect(decisions).toContain('Shorter texts from the next chapter');
  });

  it('only decides once per chapter and moves one step at a time', () => {
    const p = policy();
    p.update(run({ textNeed: 'short' }), 'c1');
    p.update(run({ textNeed: 'long' }), 'c1');
    expect(p.getPlanned().length).toBe(0);
    p.update(run({ textNeed: 'long' }), 'c2');
    expect(p.getPlanned().length).toBe(1);
  });

  it('ignores unsure conclusions and disabled rules', () => {
    const p = policy();
    p.update(run({ textNeed: 'short' }, true, 0.6), 'c1');
    expect(p.getPlanned().length).toBe(1);
    applyOverrides({ 'policy.rules.length.enabled': false });
    p.update(run({ textNeed: 'short' }), 'c2');
    expect(p.getPlanned().length).toBe(1);
  });
});
