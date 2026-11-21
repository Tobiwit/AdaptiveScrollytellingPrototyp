import { z } from 'zod';
import { defineLayout, type LayoutProps } from './types';
import { WorkFigure } from '../components/WorkFigure';
import { WorkText, countWords, workTextFor } from '../components/Text';
import { TrackedUnit } from '../components/TrackedUnit';
import { TrackedSectionText } from '../components/Tracked';
import { Reveal } from '../components/Reveal';
import { useWorkPresentation } from '../presentation/PresentationContext';
import type { Chapter, Section, Work } from '../schema/schema';
import styles from './gallery.module.css';

const Options = z.object({});

/** Several works on a grid; each work's size decides how many columns it spans. */
function Gallery({ chapter, section, works }: LayoutProps<z.infer<typeof Options>>) {
  return (
    <div className={styles.gallery}>
      <TrackedSectionText
        chapter={chapter}
        section={section}
        className={styles.intro}
        textClassName="prose"
        before={section.title && <h3 className={styles.heading}>{section.title}</h3>}
      />
      <div className={styles.grid}>
        {works.map((work) => (
          <Item key={work.id} work={work} chapter={chapter} section={section} />
        ))}
      </div>
    </div>
  );
}

function Item({ work, chapter, section }: { work: Work; chapter: Chapter; section: Section }) {
  const { size, textVariant } = useWorkPresentation(work.id);
  return (
    <TrackedUnit
      kind="work"
      chapter={chapter}
      section={section}
      work={work}
      words={countWords(workTextFor(work, textVariant))}
      hasImage
      size={size}
      className={styles.item}
      data-size={size}
    >
      <Reveal>
        <WorkFigure work={work} size={size} />
        <WorkText work={work} variant={textVariant} className={`prose ${styles.text}`} />
      </Reveal>
    </TrackedUnit>
  );
}

export default defineLayout({ options: Options, works: { min: 1 }, component: Gallery });
