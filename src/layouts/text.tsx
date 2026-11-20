import { z } from 'zod';
import { defineLayout, type LayoutProps } from './types';
import { Paragraphs } from '../components/Text';
import { Reveal } from '../components/Reveal';
import styles from './text.module.css';

const Options = z.object({
  style: z.enum(['plain', 'quote']).default('plain'),
});

function TextBlock({ section, options }: LayoutProps<z.infer<typeof Options>>) {
  if (options.style === 'quote') {
    return (
      <Reveal className={styles.wrap}>
        <figure className={styles.quote}>
          <blockquote>
            <Paragraphs text={section.text} />
          </blockquote>
          {section.attribution && <figcaption>{section.attribution}</figcaption>}
        </figure>
      </Reveal>
    );
  }
  return (
    <Reveal className={styles.wrap}>
      {section.title && <h3 className={styles.heading}>{section.title}</h3>}
      <Paragraphs text={section.text} className="prose" />
    </Reveal>
  );
}

export default defineLayout({ options: Options, works: { max: 0 }, component: TextBlock });
