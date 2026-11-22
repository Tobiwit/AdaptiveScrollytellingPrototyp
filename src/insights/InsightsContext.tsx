import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { useSignalTracker } from '../signals/SignalsContext';
import { InsightEngine } from './engine';
import type { InsightState } from './types';

const EngineContext = createContext<InsightEngine | null>(null);

/** Runs the InsightEngine on top of the session's SignalTracker. */
export function InsightsProvider({ chapterTitles, children }: { chapterTitles: Record<string, string>; children: ReactNode }) {
  const tracker = useSignalTracker();
  // A new tracker (new run) gets a new engine.
  const engine = useMemo(() => new InsightEngine(tracker, chapterTitles), [tracker, chapterTitles]);
  useEffect(() => {
    engine.start();
    if (import.meta.env.DEV) (window as unknown as { __insights: InsightEngine }).__insights = engine;
    return () => engine.stop();
  }, [engine]);
  return <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>;
}

export function useInsightEngine(): InsightEngine {
  const engine = useContext(EngineContext);
  if (!engine) throw new Error('needs an <InsightsProvider>');
  return engine;
}

export function useInsightState(): InsightState {
  const engine = useInsightEngine();
  return useSyncExternalStore(engine.subscribe, engine.getState);
}
