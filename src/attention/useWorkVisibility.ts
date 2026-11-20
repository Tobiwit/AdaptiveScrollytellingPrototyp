import { useEffect, type RefObject } from 'react';
import { attentionBus } from './eventBus';

/**
 * Emits `enter` / `exit` attention events when the element overlaps the
 * "reading band" in the middle of the viewport (works for tall elements too).
 * v1 only logs them (dev mode).
 */
export function useWorkVisibility(ref: RefObject<Element | null>, workId: string, sectionId: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let inside = false;
    const emit = (type: 'enter' | 'exit') =>
      attentionBus.emit({ workId, sectionId, type, timestamp: Date.now() });

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting === inside) return;
        inside = entry.isIntersecting;
        emit(inside ? 'enter' : 'exit');
      },
      { rootMargin: '-35% 0px -35% 0px', threshold: 0 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (inside) emit('exit');
    };
  }, [ref, workId, sectionId]);
}
