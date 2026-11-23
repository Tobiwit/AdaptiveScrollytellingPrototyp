import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { defineLayout, type LayoutProps } from './types';
import { WorkFigure, WorkCaption } from '../components/WorkFigure';
import { countWords, workTextFor } from '../components/Text';
import { AdaptiveText, useAdaptiveText } from '../components/AdaptiveText';
import { useAdaptation } from '../adaptation/AdaptationContext';
import { TrackedUnit } from '../components/TrackedUnit';
import { useWorkPresentation } from '../presentation/PresentationContext';
import { unitIdFor } from '../signals/tracker';
import type { Chapter, Section, Work } from '../schema/schema';
import styles from './work-focus.module.css';

const Options = z.object({
  side: z.enum(['left', 'right']).default('left'),
});

/** Sticky image, text scrolls past; the image swaps with the work whose text crosses the middle. */
function WorkFocus({ chapter, section, works, options }: LayoutProps<z.infer<typeof Options>>) {
  const [activeId, setActiveId] = useState(works[0].id);
  const { size } = useWorkPresentation(activeId);
  const { presence } = useAdaptation();
  const inline = presence === 0;

  return (
    <div className={styles.root} data-side={options.side} data-size={size} data-presence={presence}>
      {!inline && (
        <div className={styles.stage}>
          <div className={styles.sticky}>
            {works.map((work) => (
              <StageImage key={work.id} work={work} sectionId={section.id} active={work.id === activeId} />
            ))}
          </div>
        </div>
      )}
      <div className={styles.steps}>
        {works.map((work) => (
          <Step key={work.id} work={work} chapter={chapter} section={section} onActive={setActiveId} inline={inline} />
        ))}
      </div>
    </div>
  );
}

function StageImage({ work, sectionId, active }: { work: Work; sectionId: string; active: boolean }) {
  const { size } = useWorkPresentation(work.id);
  // lets the tracker attribute pointer time on the sticky image
  return (
    <div
      className={styles.stageItem}
      data-active={active}
      aria-hidden={!active}
      data-unit={active ? unitIdFor(sectionId, work.id) : undefined}
    >
      <WorkFigure work={work} size={size} caption={false} />
    </div>
  );
}

interface StepProps {
  work: Work;
  chapter: Chapter;
  section: Section;
  onActive: (workId: string) => void;
  /** image inside the step, no stage */
  inline: boolean;
}

function Step({ work, chapter, section, onActive, inline }: StepProps) {
  const { size, textVariant } = useWorkPresentation(work.id);
  const text = useAdaptiveText({ text: workTextFor(work, textVariant), lengths: work.lengths, context: work.context }, 'hide');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([e]) => e.isIntersecting && onActive(work.id), {
      rootMargin: '-50% 0px -50% 0px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [work.id, onActive]);

  return (
    <div ref={ref}>
      <TrackedUnit
        kind="work"
        chapter={chapter}
        section={section}
        work={work}
        words={countWords(work.headline) + text.words}
        hasImage
        size={size}
        className={styles.step}
        data-size={size}
      >
        {inline && <WorkFigure work={work} size={size} caption={false} className={styles.inlineFigure} />}
        {work.headline && <h3 className={styles.headline}>{work.headline}</h3>}
        <WorkCaption work={work} className={styles.caption} />
        <AdaptiveText state={text} className="prose" moreLabel="Read text" />
      </TrackedUnit>
    </div>
  );
}

export default defineLayout({ options: Options, works: { min: 1 }, component: WorkFocus });
