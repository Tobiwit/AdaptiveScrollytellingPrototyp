import { z } from 'zod';
import { defineLayout, type LayoutProps } from './types';
import { TrackedSectionText } from '../components/Tracked';
import { Reveal } from '../components/Reveal';
import styles from './text.module.css';

const Options = z.object({
  style: z.enum(['plain', 'quote']).default('plain'),
});

function TextBlock({ chapter, section, options }: LayoutProps<z.infer<typeof Options>>) {
  if (options.style === 'quote') {
    return (
      <Reveal className={styles.wrap}>
        <figure className={styles.quote}>
          <blockquote>
            <TrackedSectionText chapter={chapter} section={section} foldable={false} />
          </blockquote>
          {section.attribution && <figcaption>{section.attribution}</figcaption>}
        </figure>
      </Reveal>
    );
  }
  return (
    <Reveal className={styles.wrap}>
      <TrackedSectionText
        chapter={chapter}
        section={section}
        textClassName="prose"
        before={section.title && <h3 className={styles.heading}>{section.title}</h3>}
      />
    </Reveal>
  );
}

export default defineLayout({ options: Options, works: { max: 0 }, component: TextBlock });
