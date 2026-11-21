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
