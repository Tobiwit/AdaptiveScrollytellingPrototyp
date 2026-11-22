import { useCallback, useRef } from 'react';

const HOLD_MS = 1000; // layout transitions run ~700 ms

/** Keeps what you're looking at in place while content above it changes. Call before the change. */
export function useScrollAnchor(barRef: React.RefObject<HTMLElement | null>) {
  const frame = useRef(0);

  return useCallback(() => {
    const top = barRef.current?.getBoundingClientRect().bottom ?? 0;
    const y = top + (innerHeight - top) * 0.25;
    const hit = document.elementFromPoint(innerWidth / 2, y);
    const anchor = hit?.closest<HTMLElement>('[data-unit], article');
    if (!anchor) return;
    const offset = anchor.getBoundingClientRect().top;
    const until = performance.now() + HOLD_MS;

    cancelAnimationFrame(frame.current);
    const correct = () => {
      const delta = anchor.isConnected ? anchor.getBoundingClientRect().top - offset : 0;
      if (Math.abs(delta) >= 1) window.scrollBy({ top: delta, behavior: 'instant' });
      if (performance.now() < until) frame.current = requestAnimationFrame(correct);
    };
    frame.current = requestAnimationFrame(correct);
  }, [barRef]);
}
