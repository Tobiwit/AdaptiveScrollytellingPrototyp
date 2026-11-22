import { z } from 'zod';
import { defineLayout, type LayoutProps } from './types';
import { TrackedFigure, TrackedSectionText } from '../components/Tracked';
import { Reveal } from '../components/Reveal';
import { useAdaptation } from '../adaptation/AdaptationContext';
import styles from './chapter-intro.module.css';

const Options = z.object({});

function ChapterIntro({ chapter, section, works }: LayoutProps<z.infer<typeof Options>>) {
  const { presence } = useAdaptation();
  return (
    <div className={styles.intro} data-cover={works.length > 0} data-presence={presence}>
      <header className={styles.header}>
        {section.kicker && <p className="kicker">{section.kicker}</p>}
        <h2 className={styles.title}>{section.title ?? chapter.title}</h2>
      </header>
      {works[0] && <TrackedFigure chapter={chapter} section={section} work={works[0]} className={styles.cover} />}
      <Reveal className={styles.text}>
        <TrackedSectionText chapter={chapter} section={section} textClassName="prose" />
      </Reveal>
    </div>
  );
}

export default defineLayout({ options: Options, works: { max: 1 }, component: ChapterIntro });
