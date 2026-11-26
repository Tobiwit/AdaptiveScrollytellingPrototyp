import { useState } from 'react';
import { useAdaptation } from '../adaptation/AdaptationContext';
import { useSignalTracker } from '../signals/SignalsContext';
import { countWords, Paragraphs } from './Text';

export interface AdaptiveTextState {
  shown: string[];
  context?: string[];
  /** visible words, for expected dwell */
  words: number;
  fold: { open: boolean; toggle: () => void } | null;
}

export interface TextSource {
  text?: string[];
  lengths?: { short?: string[]; long?: string[] };
  context?: string[];
}

/**
 * Length picks the variant (short falls back to a trimmed text), depth hidden folds it
 * to its first sentence or entirely, deep adds the context. "fixed" texts stay as written.
 */
export function useAdaptiveText({ text, lengths, context }: TextSource, fold: 'teaser' | 'hide' | 'fixed'): AdaptiveTextState {
  const { depth, length } = useAdaptation();
  const [open, setOpen] = useState(false);
  const fixed = fold === 'fixed';
  const full = fixed ? (text ?? []) : pickLength(text ?? [], lengths, length);
  const folding = !fixed && depth === 0 && countWords(full) > 0;
  const shown = folding && !open ? (fold === 'teaser' ? teaser(full) : []) : full;
  const canToggle = folding && (open || countWords(shown) < countWords(full));
  const ctx = !fixed && depth === 2 && context?.length ? context : undefined;
  return {
    shown,
    context: ctx,
    words: countWords(shown, ctx),
    fold: canToggle ? { open, toggle: () => setOpen((o) => !o) } : null,
  };
}

export function AdaptiveText({
  state,
  className,
  moreLabel = 'More',
}: {
  state: AdaptiveTextState;
  className?: string;
  moreLabel?: string;
}) {
  const tracker = useSignalTracker();
  return (
    <>
      <Paragraphs text={state.shown} className={className} />
      {state.fold && (
        <button
          type="button"
          className="more-toggle"
          data-part="text"
          aria-expanded={state.fold.open}
          onClick={(e) => {
            const unitId = e.currentTarget.closest('[data-unit]')?.getAttribute('data-unit');
            if (unitId) tracker.expand(unitId, !state.fold!.open);
            state.fold!.toggle();
          }}
        >
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

function pickLength(text: string[], lengths: TextSource['lengths'], step: number): string[] {
  if (step === 0) return lengths?.short?.length ? lengths.short : shorten(text);
  if (step === 2) return lengths?.long?.length ? lengths.long : text;
  return text;
}

// no short variant: first paragraph, or the first two sentences of a single one
function shorten(text: string[]): string[] {
  if (text.length > 1) return [text[0]];
  const sentences = text[0]?.match(/[^.!?]+[.!?]+(\s|$)/g);
  return sentences && sentences.length > 2 ? [sentences.slice(0, 2).join('').trim()] : text;
}

function teaser(text: string[]): string[] {
  const first = text[0] ?? '';
  const sentence = first.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? first;
  return [text.length > 1 || sentence !== first ? `${sentence} …` : sentence];
}
