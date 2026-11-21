import { z } from 'zod';
import { defineLayout, type LayoutProps } from './types';
import { Paragraphs } from '../components/Text';
import { TrackedFigure, TrackedSectionText } from '../components/Tracked';
import { Reveal } from '../components/Reveal';
import styles from './closing.module.css';

const Options = z.object({});

function Closing({ exhibition, chapter, section, works }: LayoutProps<z.infer<typeof Options>>) {
  return (
    <div className={styles.closing}>
      {works[0] && <TrackedFigure chapter={chapter} section={section} work={works[0]} className={styles.cover} />}
      <Reveal className={styles.body}>
        <TrackedSectionText
          chapter={chapter}
          section={section}
          textClassName="prose"
          before={
            <>
              {section.kicker && <p className="kicker">{section.kicker}</p>}
              <h2 className={styles.title}>{section.title ?? chapter.title}</h2>
            </>
          }
        />
      </Reveal>
      {(exhibition.credits.length > 0 || exhibition.sources.length > 0) && (
        <footer className={styles.credits}>
          <h3 className="kicker">Credits</h3>
          <Paragraphs text={exhibition.credits} />
          {exhibition.sources.length > 0 && (
            <ul>
              {exhibition.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </footer>
      )}
    </div>
  );
}

export default defineLayout({ options: Options, works: { max: 1 }, component: Closing });
