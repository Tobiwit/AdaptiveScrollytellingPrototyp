import type { ReactNode } from 'react';
import type { Chapter, Section, Work } from '../schema/schema';
import { useWorkPresentation } from '../presentation/PresentationContext';
import { TrackedUnit } from './TrackedUnit';
import { WorkFigure } from './WorkFigure';
import { countWords, Paragraphs } from './Text';

interface FigureProps {
  chapter: Chapter;
  section: Section;
  work: Work;
  className?: string;
  priority?: boolean;
}

/** A work shown as an image (no text of its own), tracked as a unit. */
export function TrackedFigure({ chapter, section, work, className, priority }: FigureProps) {
  const { size } = useWorkPresentation(work.id);
  return (
    <TrackedUnit
      kind="work"
      chapter={chapter}
      section={section}
      work={work}
      words={0}
      hasImage
      size={size}
      className={className}
      data-size={size}
    >
      <WorkFigure work={work} size={size} priority={priority} />
    </TrackedUnit>
  );
}

interface TextProps {
  chapter: Chapter;
  section: Section;
  className?: string;
  textClassName?: string;
  /** Rendered before the paragraphs (e.g. a heading), inside the unit. */
  before?: ReactNode;
  after?: ReactNode;
}

/** A section's own text, tracked as a unit. Renders nothing if there's no text and no extras. */
export function TrackedSectionText({ chapter, section, className, textClassName, before, after }: TextProps) {
  const words = countWords(section.text);
  if (!words && !before && !after) return null;
  return (
    <TrackedUnit kind="text" chapter={chapter} section={section} words={words} className={className}>
      {before}
      <Paragraphs text={section.text} className={textClassName} />
      {after}
    </TrackedUnit>
  );
}
