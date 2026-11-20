import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { PresentationPolicy, WorkPresentation } from './policy';

const PolicyContext = createContext<PresentationPolicy | null>(null);

export function PresentationProvider({ policy, children }: { policy: PresentationPolicy; children: ReactNode }) {
  return <PolicyContext.Provider value={policy}>{children}</PolicyContext.Provider>;
}

/** Returns `{ size, textVariant }` for a work and re-renders when the policy changes it. */
export function useWorkPresentation(workId: string): WorkPresentation {
  const policy = useContext(PolicyContext);
  if (!policy) throw new Error('useWorkPresentation needs a <PresentationProvider>');
  const subscribe = useCallback((cb: () => void) => policy.subscribe(cb), [policy]);
  // Snapshot as a string so an unchanged decision doesn't re-render.
  const key = useSyncExternalStore(subscribe, () => {
    const p = policy.getWorkPresentation(workId);
    return `${p.size}|${p.textVariant}`;
  });
  const [size, textVariant] = key.split('|') as [WorkPresentation['size'], WorkPresentation['textVariant']];
  return { size, textVariant };
}
