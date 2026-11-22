import { useState } from 'react';
import { useAdaptation } from '../adaptation/AdaptationContext';
import { countWords, Paragraphs } from './Text';

export interface AdaptiveTextState {
  shown: string[];
  context?: string[];
  /** visible words, for expected dwell */
  words: number;
  fold: { open: boolean; toggle: () => void } | null;
}

/** Depth hidden folds the text (to its first sentence, or entirely), deep adds the context. */
export function useAdaptiveText(text: string[] | undefined, context: string[] | undefined, fold: 'teaser' | 'hide' | false): AdaptiveTextState {
  const { depth } = useAdaptation();
  const [open, setOpen] = useState(false);
  const full = text ?? [];
  const folding = fold !== false && depth === 0 && countWords(full) > 0;
  const shown = folding && !open ? (fold === 'teaser' ? teaser(full) : []) : full;
  const canToggle = folding && (open || countWords(shown) < countWords(full));
  const ctx = depth === 2 && context?.length ? context : undefined;
  return {
    shown,
    context: ctx,
    words: countWords(shown, ctx),
    fold: canToggle ? { open, toggle: () => setOpen((o) => !o) } : null,
  };
}

export function AdaptiveText({ state, className, moreLabel = 'More' }: { state: AdaptiveTextState; className?: string; moreLabel?: string }) {
  return (
    <>
      <Paragraphs text={state.shown} className={className} />
      {state.fold && (
        <button type="button" className="more-toggle" data-part="text" onClick={state.fold.toggle} aria-expanded={state.fold.open}>
          {state.fold.open ? 'Less' : moreLabel}
        </button>
      )}
      {state.context && (
        <aside className="context-layer" data-part="text">
          <p className="context-label">Background</p>
          <Paragraphs text={state.context} className="prose" />
        </aside>
      )}
    </>
  );
}

function teaser(text: string[]): string[] {
  const first = text[0] ?? '';
  const sentence = first.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? first;
  return [text.length > 1 || sentence !== first ? `${sentence} …` : sentence];
}
