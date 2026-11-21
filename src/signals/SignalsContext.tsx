import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { SignalTracker } from './tracker';
import type { SignalSnapshot, UnitMeta } from './types';

const TrackerContext = createContext<SignalTracker | null>(null);

/** Runs one SignalTracker for the session. */
export function SignalsProvider({ children }: { children: ReactNode }) {
  const [tracker] = useState(() => new SignalTracker());
  useEffect(() => {
    tracker.start();
    if (import.meta.env.DEV) (window as unknown as { __signals: SignalTracker }).__signals = tracker;
    return () => tracker.stop();
  }, [tracker]);
  return <TrackerContext.Provider value={tracker}>{children}</TrackerContext.Provider>;
}

export function useSignalTracker(): SignalTracker {
  const tracker = useContext(TrackerContext);
  if (!tracker) throw new Error('needs a <SignalsProvider>');
  return tracker;
}

/** Live snapshot of all signals (updates every tick). */
export function useSignalSnapshot(): SignalSnapshot {
  const tracker = useSignalTracker();
  return useSyncExternalStore(tracker.subscribe, tracker.getSnapshot);
}

/** Registers an element as a tracked unit. Re-registers when its meta changes. */
export function useTrackedUnit(ref: RefObject<HTMLElement | null>, meta: UnitMeta) {
  const tracker = useSignalTracker();
  const { unitId, kind, chapterId, sectionId, workId, label, words, hasImage, size } = meta;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return tracker.register(el, { unitId, kind, chapterId, sectionId, workId, label, words, hasImage, size });
  }, [tracker, ref, unitId, kind, chapterId, sectionId, workId, label, words, hasImage, size]);
}
