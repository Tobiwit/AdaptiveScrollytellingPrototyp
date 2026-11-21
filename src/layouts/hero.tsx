import { z } from 'zod';
import { defineLayout, type LayoutProps } from './types';
import { TrackedFigure, TrackedSectionText } from '../components/Tracked';
import styles from './hero.module.css';

const Options = z.object({});

function Hero({ exhibition, chapter, section, works }: LayoutProps<z.infer<typeof Options>>) {
  const cover = works[0];
  return (
    <div className={styles.hero}>
      <div className={styles.text}>
        {section.kicker && <p className="kicker">{section.kicker}</p>}
        <h1 className={styles.title}>{section.title ?? exhibition.title}</h1>
        {exhibition.subtitle && <p className={styles.subtitle}>{exhibition.subtitle}</p>}
        <TrackedSectionText chapter={chapter} section={section} textClassName={styles.body} />
        <p className={styles.cue} aria-hidden="true">
          Scroll to begin ↓
        </p>
      </div>
      {cover && <TrackedFigure chapter={chapter} section={section} work={cover} className={styles.cover} priority />}
    </div>
  );
}

export default defineLayout({ options: Options, works: { max: 1 }, component: Hero });
