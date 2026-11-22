import type { TextVariant, Work, WorkSize } from '../schema/schema';

export interface WorkPresentation {
  size: WorkSize;
  textVariant: TextVariant;
}

/** Adaptation seam: components get size and text variant only from here. */
export interface PresentationPolicy {
  getWorkPresentation(workId: string): WorkPresentation;
  subscribe(listener: () => void): () => void;
}

/** v1: content defaults, never changes. */
export class StaticPolicy implements PresentationPolicy {
  constructor(
    private readonly works: Map<string, Work>,
    private readonly defaults: WorkPresentation,
  ) {}

  getWorkPresentation(workId: string): WorkPresentation {
    const work = this.works.get(workId);
    return {
      size: work?.size ?? this.defaults.size,
      textVariant: this.defaults.textVariant,
    };
  }

  subscribe(): () => void {
    return () => {};
  }
}
