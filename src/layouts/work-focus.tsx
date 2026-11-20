import { useEffect, useState } from 'react';
import { z } from 'zod';
import { defineLayout, type LayoutProps } from './types';
import { WorkFigure, WorkCaption } from '../components/WorkFigure';
import { WorkText } from '../components/Text';
import { ObservedWork } from '../components/ObservedWork';
import { useWorkPresentation } from '../presentation/PresentationContext';
import { attentionBus } from '../attention/eventBus';
import type { Work } from '../schema/schema';
import styles from './work-focus.module.css';

const Options = z.object({
  /** Which side the sticky image sits on. */
  side: z.enum(['left', 'right']).default('left'),
});

/**
 * Sticky image with scrolling text. With several works, the image swaps to
 * whichever work's text is in the reading band.
 */
function WorkFocus({ section, works, options }: LayoutProps<z.infer<typeof Options>>) {
  const [activeId, setActiveId] = useState(works[0].id);
  const { size } = useWorkPresentation(activeId);

  useEffect(
    () =>
      attentionBus.subscribe((e) => {
        if (e.sectionId === section.id && e.type === 'enter') setActiveId(e.workId);
      }),
    [section.id],
  );

  return (
    <div className={styles.root} data-side={options.side} data-size={size}>
      <div className={styles.stage}>
        <div className={styles.sticky}>
          {works.map((work) => (
            <StageImage key={work.id} work={work} active={work.id === activeId} />
          ))}
        </div>
      </div>
      <div className={styles.steps}>
        {works.map((work) => (
          <Step key={work.id} work={work} sectionId={section.id} />
        ))}
      </div>
    </div>
  );
}

function StageImage({ work, active }: { work: Work; active: boolean }) {
  const { size } = useWorkPresentation(work.id);
  return (
    <div className={styles.stageItem} data-active={active} aria-hidden={!active}>
      <WorkFigure work={work} size={size} caption={false} />
    </div>
  );
}

function Step({ work, sectionId }: { work: Work; sectionId: string }) {
  const { textVariant } = useWorkPresentation(work.id);
  return (
    <ObservedWork workId={work.id} sectionId={sectionId} className={styles.step}>
      {work.headline && <h3 className={styles.headline}>{work.headline}</h3>}
      <WorkCaption work={work} className={styles.caption} />
      <WorkText work={work} variant={textVariant} className="prose" />
    </ObservedWork>
  );
}

export default defineLayout({ options: Options, works: { min: 1 }, component: WorkFocus });
