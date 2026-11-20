import { z } from 'zod';
import { defineLayout, type LayoutProps } from './types';
import { WorkFigure } from '../components/WorkFigure';
import { Paragraphs } from '../components/Text';
import { ObservedWork } from '../components/ObservedWork';
import { useWorkPresentation } from '../presentation/PresentationContext';
import styles from './hero.module.css';

const Options = z.object({});

function Hero({ exhibition, section, works }: LayoutProps<z.infer<typeof Options>>) {
  const cover = works[0];
  return (
    <div className={styles.hero}>
      <div className={styles.text}>
        {section.kicker && <p className="kicker">{section.kicker}</p>}
        <h1 className={styles.title}>{section.title ?? exhibition.title}</h1>
        {exhibition.subtitle && <p className={styles.subtitle}>{exhibition.subtitle}</p>}
        <Paragraphs text={section.text} className={styles.body} />
        <p className={styles.cue} aria-hidden="true">
          Scroll to begin ↓
        </p>
      </div>
      {cover && <Cover workId={cover.id} sectionId={section.id} works={works} />}
    </div>
  );
}

function Cover({ workId, sectionId, works }: { workId: string; sectionId: string; works: LayoutProps['works'] }) {
  const { size } = useWorkPresentation(workId);
  return (
    <ObservedWork workId={workId} sectionId={sectionId} className={styles.cover}>
      <WorkFigure work={works[0]} size={size} priority />
    </ObservedWork>
  );
}

export default defineLayout({ options: Options, works: { max: 1 }, component: Hero });
