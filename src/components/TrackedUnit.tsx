import { useRef, type ReactNode } from 'react';
import type { Chapter, Section, Work, WorkSize } from '../schema/schema';
import { useTrackedUnit } from '../signals/SignalsContext';
import { unitIdFor } from '../signals/tracker';
import type { UnitKind } from '../signals/types';

interface Props {
  kind: UnitKind;
  chapter: Chapter;
  section: Section;
  work?: Work;
  /** Words of text shown inside this unit. */
  words: number;
  hasImage?: boolean;
  size?: WorkSize;
  className?: string;
  children: ReactNode;
  [data: `data-${string}`]: string | undefined;
}

/**
 * Wraps whatever represents a work (or a section's text) in a layout so the
 * signal tracker can attribute dwell, scrolling, pointer and clicks to it.
 */
export function TrackedUnit({ kind, chapter, section, work, words, hasImage = false, size, className, children, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const unitId = unitIdFor(section.id, work?.id);
  const label = work?.title ?? section.title ?? section.kicker ?? firstWords(section.text) ?? chapter.title;
  useTrackedUnit(ref, {
    unitId,
    kind,
    chapterId: chapter.id,
    sectionId: section.id,
    workId: work?.id,
    label,
    words,
    hasImage,
    size,
  });
  return (
    <div ref={ref} className={className} data-unit={unitId} {...rest}>
      {children}
    </div>
  );
}

function firstWords(text?: string[]) {
  const words = text?.[0]?.split(/\s+/).slice(0, 6).join(' ');
  return words ? `${words}…` : undefined;
}
