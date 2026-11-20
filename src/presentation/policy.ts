import type { TextVariant, Work, WorkSize } from '../schema/schema';

export interface WorkPresentation {
  size: WorkSize;
  textVariant: TextVariant;
}

/**
 * Decides how each work is presented. Components never read size or text
 * variant from the content directly; they ask the active policy.
 *
 * Adaptation seam: an AdaptivePolicy implements this same interface and calls
 * the subscribed listeners whenever its decisions change.
 */
export interface PresentationPolicy {
  getWorkPresentation(workId: string): WorkPresentation;
  subscribe(listener: () => void): () => void;
}

/** v1 policy: returns the content defaults and never changes. */
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
