import { z } from 'zod';

export const Paragraphs = z.array(z.string());

export const WorkSize = z.enum(['S', 'M', 'L']);
export type WorkSize = z.infer<typeof WorkSize>;

export const TextVariant = z.enum(['short', 'long']);
export type TextVariant = z.infer<typeof TextVariant>;

export const Work = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  artist: z.string(),
  year: z.string(),
  institution: z.string(),
  medium: z.string().optional(),
  /** if the text has its own heading */
  headline: z.string().optional(),
  image: z.object({
    /** images/… (content folder) or /media/… (gitignored assets) */
    src: z.string().min(1),
    alt: z.string().min(1),
    credit: z.string(),
    sourceUrl: z.string().optional(),
  }),
  text: z.object({
    short: Paragraphs,
    long: Paragraphs,
  }),
  /** only shown at depth "deep" */
  context: Paragraphs.optional(),
  /** for similarity later */
  tags: z.record(z.string(), z.unknown()).default({}),
  size: WorkSize.default('M'),
});
export type Work = z.infer<typeof Work>;

/** One layout module. Layout-specific settings go in `options`, checked by the layout's schema. */
export const Section = z.object({
  id: z.string().min(1),
  layout: z.string().min(1),
  kicker: z.string().optional(),
  title: z.string().optional(),
  text: Paragraphs.optional(),
  /** only shown at depth "deep" */
  context: Paragraphs.optional(),
  attribution: z.string().optional(),
  works: z.array(z.string()).default([]),
  options: z.record(z.string(), z.unknown()).default({}),
});
export type Section = z.infer<typeof Section>;

export const Chapter = z.object({
  id: z.string().min(1),
  /** nav label, e.g. "1" */
  label: z.string().optional(),
  title: z.string().min(1),
  sections: z.array(Section).min(1),
});
export type Chapter = z.infer<typeof Chapter>;

export const Theme = z.object({
  colors: z.record(z.string(), z.string()).default({}),
  fonts: z.record(z.string(), z.string()).default({}),
});
export type Theme = z.infer<typeof Theme>;

export const Exhibition = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  locale: z.string().default('en'),
  theme: Theme.default({ colors: {}, fonts: {} }),
  credits: Paragraphs.default([]),
  sources: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  defaults: z
    .object({
      size: WorkSize.default('M'),
      textVariant: TextVariant.default('long'),
    })
    .default({ size: 'M', textVariant: 'long' }),
  chapters: z.array(Chapter).min(1),
});
export type Exhibition = z.infer<typeof Exhibition>;

export const Works = z.array(Work);
