import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSignalTracker } from '../signals/SignalsContext';
import { useInsightEngine } from '../insights/InsightsContext';
import { concludeRun, type RunConclusions } from './conclude';

const Ctx = createContext<RunConclusions | null>(null);

/** Recomputed every second. */
export function ConclusionsProvider({ hasTags, children }: { hasTags: boolean; children: ReactNode }) {
  const tracker = useSignalTracker();
  const engine = useInsightEngine();
  const [state, setState] = useState(() => concludeRun(tracker.getSnapshot(), engine.getState(), null, hasTags));

  useEffect(() => {
    // new run: forget the old settled beliefs
    setState(concludeRun(tracker.getSnapshot(), engine.getState(), null, hasTags));
    const id = setInterval(() => setState((prev) => concludeRun(tracker.getSnapshot(), engine.getState(), prev, hasTags)), 1000);
    return () => clearInterval(id);
  }, [tracker, engine, hasTags]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useRunConclusions(): RunConclusions {
  const c = useContext(Ctx);
  if (!c) throw new Error('needs a <ConclusionsProvider>');
  return c;
}
