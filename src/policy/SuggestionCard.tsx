import { Reveal } from '../components/Reveal';
import type { Suggestion } from './AdaptivePolicy';
import { useAdaptivePolicy, useSuggestion } from './PolicyContext';
import styles from './SuggestionCard.module.css';

const COPY: Record<string, { ask: string; why: string; yes: string; done: string }> = {
  'length:down': { ask: 'Shorter texts from here?', why: 'You’re moving at a good pace.', yes: 'Shorter texts', done: 'Shorter texts from here on' },
  'length:up': { ask: 'Longer texts from here?', why: 'You seem to enjoy the reading.', yes: 'Longer texts', done: 'Longer texts from here on' },
  'depth:down': { ask: 'Fold away the background texts?', why: 'You’ve mostly been passing over them.', yes: 'Fold them away', done: 'Background folded away' },
  'depth:up': { ask: 'Show more background?', why: 'You’ve been reading the context closely.', yes: 'Show more', done: 'More background from here on' },
  'images:up': { ask: 'Give the paintings more room?', why: 'You’ve been spending time with the images.', yes: 'More room', done: 'Larger images from here on' },
  'images:down': { ask: 'Let the texts lead?', why: 'You’ve been focusing on the texts.', yes: 'Texts first', done: 'Texts lead from here on' },
};

function copyFor(s: Suggestion) {
  const dims = s.changes.map((c) => c.dimension);
  const topic = dims.every((d) => d === 'size' || d === 'presence') ? 'images' : dims[0];
  const up = s.changes[0].to > s.changes[0].from;
  return COPY[`${topic}:${up ? 'up' : 'down'}`];
}

/** Shown at the start of a chapter when the policy (in suggest mode) offers a change. */
export function SuggestionCard({ chapterId }: { chapterId: string }) {
  const policy = useAdaptivePolicy();
  const s = useSuggestion(chapterId);
  if (!policy || !s) return null;
  const copy = copyFor(s);

  return (
    <Reveal className={styles.wrap}>
      <aside className={styles.card} aria-label="Suggestion" data-signals-ignore data-status={s.status}>
        {(s.status === 'offered' || s.status === 'ignored') && (
          <>
            <p className={styles.ask}>{copy.ask}</p>
            <p className={styles.why}>{copy.why}</p>
            <div className={styles.actions}>
              <button type="button" className={styles.yes} onClick={() => policy.accept(s.id)}>
                {copy.yes}
              </button>
              <button type="button" className={styles.no} onClick={() => policy.decline(s.id)}>
                Keep as is
              </button>
            </div>
          </>
        )}
        {s.status === 'accepted' && (
          <p className={styles.line}>
            {copy.done}
            <span aria-hidden="true"> · </span>
            <button type="button" className={styles.undo} onClick={() => policy.undo(s.id)}>
              Undo
            </button>
          </p>
        )}
        {s.status === 'declined' && <p className={styles.line}>Keeping things as they are</p>}
        {s.status === 'undone' && <p className={styles.line}>Changed back</p>}
      </aside>
    </Reveal>
  );
}
