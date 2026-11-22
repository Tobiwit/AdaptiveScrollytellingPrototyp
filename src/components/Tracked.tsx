import type { ReactNode } from 'react';
import type { Chapter, Section, Work } from '../schema/schema';
import { useWorkPresentation } from '../presentation/PresentationContext';
import { TrackedUnit } from './TrackedUnit';
import { WorkFigure } from './WorkFigure';
import { countWords } from './Text';
import { AdaptiveText, useAdaptiveText } from './AdaptiveText';

interface FigureProps {
  chapter: Chapter;
  section: Section;
  work: Work;
  className?: string;
  priority?: boolean;
}

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
  before?: ReactNode;
  after?: ReactNode;
  /** quotes don't fold */
  foldable?: boolean;
}

export function TrackedSectionText({ chapter, section, className, textClassName, before, after, foldable = true }: TextProps) {
  const text = useAdaptiveText(section.text, section.context, foldable && 'teaser');
  if (!countWords(section.text) && !before && !after) return null;
  return (
    <TrackedUnit kind="text" chapter={chapter} section={section} words={text.words} className={className}>
      {before}
      <AdaptiveText state={text} className={textClassName} />
      {after}
    </TrackedUnit>
  );
}
