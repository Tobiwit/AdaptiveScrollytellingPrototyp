import { createContext, useContext, type ReactNode } from 'react';

/** 1 = as authored */
export type Step = 0 | 1 | 2;

// Length is resolved in the content (which text gets passed in), so layouts don't read it.
// Image size is per work and comes from the PresentationPolicy.
export interface Adaptation {
  length: Step;
  depth: Step;
  presence: Step;
}

export const BASELINE: Adaptation = { length: 1, depth: 1, presence: 1 };

const Ctx = createContext<Adaptation>(BASELINE);

export function AdaptationProvider({ value, children }: { value: Adaptation; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdaptation(): Adaptation {
  return useContext(Ctx);
}
