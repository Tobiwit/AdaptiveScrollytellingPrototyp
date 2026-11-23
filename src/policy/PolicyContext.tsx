import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { AdaptationProvider, type Step } from '../adaptation/AdaptationContext';
import { useRunConclusions } from '../conclusions/ConclusionsContext';
import { useSignalTracker } from '../signals/SignalsContext';
import type { AdaptivePolicy, Steps } from './AdaptivePolicy';

const Ctx = createContext<AdaptivePolicy | null>(null);

export function PolicyProvider({ policy, children }: { policy: AdaptivePolicy | null; children: ReactNode }) {
  return <Ctx.Provider value={policy}>{children}</Ctx.Provider>;
}

/** null unless the exhibition runs with ?adaptive */
export function useAdaptivePolicy(): AdaptivePolicy | null {
  return useContext(Ctx);
}

export function useChapterSteps(chapterId: string): Steps | null {
  const policy = useAdaptivePolicy();
  const key = useSyncExternalStore(policy?.subscribe ?? noop, () => (policy ? stepsKey(policy.stepsFor(chapterId)) : ''));
  return useMemo(() => (key ? parseSteps(key) : null), [key]);
}

export function usePlannedSteps(): Steps | null {
  const policy = useAdaptivePolicy();
  const key = useSyncExternalStore(policy?.subscribe ?? noop, () => (policy ? `${stepsKey(policy.getPlanned())}|${policy.status}` : ''));
  return useMemo(() => (key ? parseSteps(key.split('|')[0]) : null), [key]);
}

export function ChapterAdaptation({ chapterId, children }: { chapterId: string; children: ReactNode }) {
  const steps = useChapterSteps(chapterId);
  if (!steps) return children;
  return <AdaptationProvider value={steps}>{children}</AdaptationProvider>;
}

/** Feeds the policy with the run conclusions and the chapter in the reading band. */
export function PolicyDriver() {
  const policy = useAdaptivePolicy();
  const tracker = useSignalTracker();
  const run = useRunConclusions();

  useEffect(() => policy?.reset(), [policy, tracker]);

  useEffect(() => {
    if (!policy) return;
    const snap = tracker.getSnapshot();
    const unit = snap.units.find((u) => u.unitId === snap.session.bandFocusUnitId);
    policy.update(run, unit?.chapterId ?? null);
  }, [policy, tracker, run]);

  return null;
}

const noop = () => () => {};
const stepsKey = (s: Steps) => `${s.length}${s.depth}${s.size}${s.presence}`;
const parseSteps = (k: string): Steps => {
  const [length, depth, size, presence] = [...k].map(Number) as Step[];
  return { length, depth, size, presence };
};
