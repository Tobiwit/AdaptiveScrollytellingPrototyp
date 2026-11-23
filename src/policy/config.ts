import type { ConclusionId } from '../conclusions/conclude';

export type Dimension = 'length' | 'depth' | 'size' | 'presence';

export interface Rule {
  enabled: boolean;
  from: ConclusionId;
}

export const policyConfig = {
  requireCalibration: true,
  minConfidence: 0.7, // on top of being settled
  maxStepPerChapter: 1,
  rules: {
    length: { enabled: true, from: 'textNeed' },
    depth: { enabled: true, from: 'context' },
    size: { enabled: true, from: 'visual' },
    presence: { enabled: true, from: 'visual' },
  } as Record<Dimension, Rule>,
};

/** Values in step order: the first maps to step 0, the last to step 2. */
export const CONCLUSION_VALUES: Partial<Record<ConclusionId, string[]>> = {
  textNeed: ['short', 'standard', 'long'],
  context: ['low', 'medium', 'high'],
  visual: ['text-led', 'balanced', 'image-led'],
  trend: ['falling', 'stable', 'rising'],
  strain: ['none', 'possible', 'likely'],
  navigation: ['linear', 'revisiting', 'jumping'],
  trust: ['low', 'medium', 'high'],
};
