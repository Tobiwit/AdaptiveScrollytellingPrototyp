import { z } from 'zod';
import { defineLayout, type LayoutProps } from './types';
import { WorkFigure } from '../components/WorkFigure';
import { Paragraphs } from '../components/Text';
import { ObservedWork } from '../components/ObservedWork';
import { Reveal } from '../components/Reveal';
import { useWorkPresentation } from '../presentation/PresentationContext';
import type { Work } from '../schema/schema';
import styles from './closing.module.css';

const Options = z.object({});

function Closing({ exhibition, chapter, section, works }: LayoutProps<z.infer<typeof Options>>) {
  return (
    <div className={styles.closing}>
      {works[0] && <Cover work={works[0]} sectionId={section.id} />}
      <Reveal className={styles.body}>
        {section.kicker && <p className="kicker">{section.kicker}</p>}
        <h2 className={styles.title}>{section.title ?? chapter.title}</h2>
        <Paragraphs text={section.text} className="prose" />
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

function Cover({ work, sectionId }: { work: Work; sectionId: string }) {
  const { size } = useWorkPresentation(work.id);
  return (
    <ObservedWork workId={work.id} sectionId={sectionId} className={styles.cover}>
      <WorkFigure work={work} size={size} />
    </ObservedWork>
  );
}

export default defineLayout({ options: Options, works: { max: 1 }, component: Closing });
