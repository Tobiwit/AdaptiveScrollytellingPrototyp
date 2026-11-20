import { z } from 'zod';
import { defineLayout, type LayoutProps } from './types';
import { WorkFigure } from '../components/WorkFigure';
import { Paragraphs } from '../components/Text';
import { ObservedWork } from '../components/ObservedWork';
import { Reveal } from '../components/Reveal';
import { useWorkPresentation } from '../presentation/PresentationContext';
import type { Work } from '../schema/schema';
import styles from './chapter-intro.module.css';

const Options = z.object({});

function ChapterIntro({ chapter, section, works }: LayoutProps<z.infer<typeof Options>>) {
  return (
    <div className={styles.intro} data-cover={works.length > 0}>
      <header className={styles.header}>
        {section.kicker && <p className="kicker">{section.kicker}</p>}
        <h2 className={styles.title}>{section.title ?? chapter.title}</h2>
      </header>
      {works[0] && <Cover work={works[0]} sectionId={section.id} />}
      <Reveal className={styles.text}>
        <Paragraphs text={section.text} className="prose" />
      </Reveal>
    </div>
  );
}

function Cover({ work, sectionId }: { work: Work; sectionId: string }) {
  const { size } = useWorkPresentation(work.id);
  return (
    <ObservedWork workId={work.id} sectionId={sectionId} className={styles.cover}>
      <WorkFigure work={work} size={size} />
    </ObservedWork>
  );
}

export default defineLayout({ options: Options, works: { max: 1 }, component: ChapterIntro });
