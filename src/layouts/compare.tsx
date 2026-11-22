import { z } from 'zod';
import { defineLayout, type LayoutProps } from './types';
import { TrackedFigure, TrackedSectionText } from '../components/Tracked';
import { Reveal } from '../components/Reveal';
import { useAdaptation } from '../adaptation/AdaptationContext';
import styles from './compare.module.css';

const Options = z.object({});

function Compare({ chapter, section, works }: LayoutProps<z.infer<typeof Options>>) {
  const { presence } = useAdaptation();
  return (
    <div className={styles.compare} data-presence={presence}>
      {section.title && <h3 className={styles.heading}>{section.title}</h3>}
      <div className={styles.pair}>
        {works.map((work) => (
          <TrackedFigure key={work.id} chapter={chapter} section={section} work={work} className={styles.side} />
        ))}
      </div>
      <Reveal>
        <TrackedSectionText chapter={chapter} section={section} textClassName={`prose ${styles.text}`} />
      </Reveal>
    </div>
  );
}

export default defineLayout({ options: Options, works: { min: 2, max: 2 }, component: Compare });
