export interface AttentionEvent {
  workId: string;
  sectionId: string;
  type: 'enter' | 'exit';
  timestamp: number;
}

export interface EventBus<T> {
  emit(event: T): void;
  subscribe(listener: (event: T) => void): () => void;
}

/** Minimal in-memory pub/sub. Nothing is stored. */
export function createEventBus<T>(): EventBus<T> {
  const listeners = new Set<(event: T) => void>();
  return {
    emit(event) {
      for (const l of listeners) l(event);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * The single attention bus for the session.
 * Adaptation seam: an AdaptivePolicy subscribes here to score works.
 */
export const attentionBus = createEventBus<AttentionEvent>();

if (import.meta.env.DEV) {
  attentionBus.subscribe((e) => console.debug(`[attention] ${e.type} ${e.workId} (${e.sectionId})`));
}
