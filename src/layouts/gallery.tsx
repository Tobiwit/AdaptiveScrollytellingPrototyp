import { useEffect, useState } from 'react';
import { z } from 'zod';
import { defineLayout, type LayoutProps } from './types';
import { WorkFigure } from '../components/WorkFigure';
import { workTextFor } from '../components/Text';
import { AdaptiveText, useAdaptiveText } from '../components/AdaptiveText';
import { TrackedUnit } from '../components/TrackedUnit';
import { TrackedSectionText } from '../components/Tracked';
import { Reveal } from '../components/Reveal';
import { useWorkPresentation } from '../presentation/PresentationContext';
import { useAdaptation } from '../adaptation/AdaptationContext';
import type { Chapter, Section, Work } from '../schema/schema';
import styles from './gallery.module.css';

const Options = z.object({});

/** shown at presence "supporting" */
const SUPPORTING_COUNT = 2;

function Gallery({ chapter, section, works }: LayoutProps<z.infer<typeof Options>>) {
  const { presence } = useAdaptation();
  const [all, setAll] = useState(false);
  useEffect(() => setAll(false), [presence]);
  // TODO: use the visitor's top works (workScores)
  const shown = presence === 0 && !all ? works.slice(0, SUPPORTING_COUNT) : works;
  const hidden = works.length - shown.length;

  return (
    <div className={styles.gallery} data-presence={presence}>
      <TrackedSectionText
        chapter={chapter}
        section={section}
        className={styles.intro}
        textClassName="prose"
        before={section.title && <h3 className={styles.heading}>{section.title}</h3>}
      />
      <div className={styles.grid}>
        {shown.map((work) => (
          <Item key={work.id} work={work} chapter={chapter} section={section} />
        ))}
      </div>
      {hidden > 0 && (
        <button type="button" className={`more-toggle ${styles.showAll}`} onClick={() => setAll(true)}>
          Show all {works.length} works
        </button>
      )}
    </div>
  );
}

function Item({ work, chapter, section }: { work: Work; chapter: Chapter; section: Section }) {
  const { size, textVariant } = useWorkPresentation(work.id);
  const text = useAdaptiveText(workTextFor(work, textVariant), work.context, 'hide');
  return (
    <TrackedUnit
      kind="work"
      chapter={chapter}
      section={section}
      work={work}
      words={text.words}
      hasImage
      size={size}
      className={styles.item}
      data-size={size}
    >
      <Reveal className={styles.inner}>
        <WorkFigure work={work} size={size} />
        <div className={styles.text}>
          <AdaptiveText state={text} className="prose" moreLabel="Read text" />
        </div>
      </Reveal>
    </TrackedUnit>
  );
}

export default defineLayout({ options: Options, works: { min: 1 }, component: Gallery });
