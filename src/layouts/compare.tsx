import { z } from 'zod';
import { defineLayout, type LayoutProps } from './types';
import { WorkFigure } from '../components/WorkFigure';
import { Paragraphs } from '../components/Text';
import { ObservedWork } from '../components/ObservedWork';
import { Reveal } from '../components/Reveal';
import { useWorkPresentation } from '../presentation/PresentationContext';
import type { Work } from '../schema/schema';
import styles from './compare.module.css';

const Options = z.object({});

/** Two works side by side, with the section's text underneath. */
function Compare({ section, works }: LayoutProps<z.infer<typeof Options>>) {
  return (
    <div className={styles.compare}>
      {section.title && <h3 className={styles.heading}>{section.title}</h3>}
      <div className={styles.pair}>
        {works.map((work) => (
          <Side key={work.id} work={work} sectionId={section.id} />
        ))}
      </div>
      <Reveal>
        <Paragraphs text={section.text} className={`prose ${styles.text}`} />
      </Reveal>
    </div>
  );
}

function Side({ work, sectionId }: { work: Work; sectionId: string }) {
  const { size } = useWorkPresentation(work.id);
  return (
    <ObservedWork workId={work.id} sectionId={sectionId} className={styles.side} data-size={size}>
      <WorkFigure work={work} size={size} />
    </ObservedWork>
  );
}

export default defineLayout({ options: Options, works: { min: 2, max: 2 }, component: Compare });
