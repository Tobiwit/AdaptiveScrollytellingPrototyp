import type { Work, WorkSize } from '../schema/schema';
import { useLightbox } from './Lightbox';
import styles from './WorkFigure.module.css';

interface Props {
  work: Work;
  size: WorkSize;
  priority?: boolean;
  caption?: boolean;
  className?: string;
}

export function WorkFigure({ work, size, priority, caption = true, className }: Props) {
  const lightbox = useLightbox();
  const img = (
    <img
      className={styles.img}
      data-part="image"
      src={work.image.src}
      alt={work.image.alt}
      loading={priority ? 'eager' : 'lazy'}
      // Google's image servers throttle requests that carry a foreign Referer.
      referrerPolicy="no-referrer"
      decoding="async"
    />
  );
  return (
    <figure className={`${styles.figure} ${className ?? ''}`} data-size={size}>
      {lightbox ? (
        <button
          type="button"
          className={`${styles.frame} ${styles.zoom}`}
          aria-label={`Open “${work.title}” full screen`}
          onClick={(e) => lightbox(work, e.currentTarget.closest('[data-unit]')?.getAttribute('data-unit') ?? null)}
        >
          {img}
        </button>
      ) : (
        <div className={styles.frame}>{img}</div>
      )}
      {caption && <WorkCaption work={work} className={styles.caption} />}
    </figure>
  );
}

export function WorkCaption({ work, className }: { work: Work; className?: string }) {
  const line = [work.artist, work.year].filter(Boolean).join(', ');
  return (
    <figcaption className={`${styles.captionBase} ${className ?? ''}`} data-part="caption">
      <span className={styles.title}>{work.title}</span>
      {line && <span>{line}</span>}
      {work.institution && <span className={styles.muted}>{work.institution}</span>}
    </figcaption>
  );
}
