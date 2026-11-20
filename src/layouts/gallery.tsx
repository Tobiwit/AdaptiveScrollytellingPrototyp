import { z } from 'zod';
import { defineLayout, type LayoutProps } from './types';
import { WorkFigure } from '../components/WorkFigure';
import { Paragraphs, WorkText } from '../components/Text';
import { ObservedWork } from '../components/ObservedWork';
import { Reveal } from '../components/Reveal';
import { useWorkPresentation } from '../presentation/PresentationContext';
import type { Work } from '../schema/schema';
import styles from './gallery.module.css';

const Options = z.object({});

/** Several works on a grid; each work's size decides how many columns it spans. */
function Gallery({ section, works }: LayoutProps<z.infer<typeof Options>>) {
  return (
    <div className={styles.gallery}>
      {section.title && <h3 className={styles.heading}>{section.title}</h3>}
      <Paragraphs text={section.text} className={`prose ${styles.intro}`} />
      <div className={styles.grid}>
        {works.map((work) => (
          <Item key={work.id} work={work} sectionId={section.id} />
        ))}
      </div>
    </div>
  );
}

function Item({ work, sectionId }: { work: Work; sectionId: string }) {
  const { size, textVariant } = useWorkPresentation(work.id);
  return (
    <ObservedWork workId={work.id} sectionId={sectionId} className={styles.item} data-size={size}>
      <Reveal>
        <WorkFigure work={work} size={size} />
        <WorkText work={work} variant={textVariant} className={`prose ${styles.text}`} />
      </Reveal>
    </ObservedWork>
  );
}

export default defineLayout({ options: Options, works: { min: 1 }, component: Gallery });
