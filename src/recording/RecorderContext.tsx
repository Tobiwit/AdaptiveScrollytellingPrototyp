import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useSignalTracker } from '../signals/SignalsContext';
import { useInsightEngine } from '../insights/InsightsContext';
import { useRunConclusions } from '../conclusions/ConclusionsContext';
import { useAdaptivePolicy } from '../policy/PolicyContext';
import { RunRecorder, type RunFile, type RunMeta } from './recorder';

const Ctx = createContext<RunRecorder | null>(null);
const LAST_RUN = 'last-run';

/** One recorder per run; the finished run is kept in localStorage as the last run. */
export function RecorderProvider({ meta, children }: { meta: Pick<RunMeta, 'condition' | 'exhibition' | 'contentHash'>; children: ReactNode }) {
  const tracker = useSignalTracker();
  const engine = useInsightEngine();
  const policy = useAdaptivePolicy();
  const run = useRunConclusions();
  const recorder = useMemo(() => new RunRecorder(tracker, engine, policy, meta), [tracker, engine, policy, meta]);

  useEffect(() => {
    recorder.start();
    if (import.meta.env.DEV) (window as unknown as { __recorder: RunRecorder }).__recorder = recorder;
    const save = () => saveLastRun(recorder.toJSON());
    addEventListener('pagehide', save);
    return () => {
      removeEventListener('pagehide', save);
      save();
      recorder.stop();
    };
  }, [recorder]);

  useEffect(() => recorder.conclude(run), [recorder, run]);

  return <Ctx.Provider value={recorder}>{children}</Ctx.Provider>;
}

export function useRecorder(): RunRecorder | null {
  return useContext(Ctx);
}

function saveLastRun(run: RunFile) {
  if (!run.events.length) return;
  try {
    localStorage.setItem(LAST_RUN, JSON.stringify(run));
  } catch {
    /* too big or storage blocked */
  }
}

export function loadLastRun(): RunFile | null {
  try {
    return JSON.parse(localStorage.getItem(LAST_RUN) ?? 'null');
  } catch {
    return null;
  }
}
