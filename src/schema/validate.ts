import { z } from 'zod';
import { Exhibition, Works, type Work } from './schema';

export interface LayoutSpec {
  options: z.ZodType;
  works?: { min?: number; max?: number };
}

export interface LoadedExhibition {
  exhibition: Exhibition;
  works: Map<string, Work>;
}

export class ContentError extends Error {}

/**
 * Parses raw JSON and checks everything the schema alone can't:
 * unique ids, work references, known layouts and per-layout options.
 * Pure (no Vite APIs), so the app and the tests share it.
 */
export function validateContent(
  rawExhibition: unknown,
  rawWorks: unknown,
  layouts: Record<string, LayoutSpec>,
): LoadedExhibition {
  const problems: string[] = [];
  const exParsed = Exhibition.safeParse(rawExhibition);
  const worksParsed = Works.safeParse(rawWorks);
  if (!exParsed.success) problems.push('exhibition.json: ' + z.prettifyError(exParsed.error));
  if (!worksParsed.success) problems.push('works.json: ' + z.prettifyError(worksParsed.error));
  if (!exParsed.success || !worksParsed.success) throw new ContentError(problems.join('\n'));

  const exhibition = exParsed.data;
  const works = new Map<string, Work>();
  for (const w of worksParsed.data) {
    if (works.has(w.id)) problems.push(`duplicate work id "${w.id}"`);
    works.set(w.id, w);
  }

  const ids = new Set<string>();
  for (const chapter of exhibition.chapters) {
    if (ids.has(chapter.id)) problems.push(`duplicate id "${chapter.id}"`);
    ids.add(chapter.id);
    for (const section of chapter.sections) {
      const where = `section "${section.id}"`;
      if (ids.has(section.id)) problems.push(`duplicate id "${section.id}"`);
      ids.add(section.id);

      for (const workId of section.works) {
        if (!works.has(workId)) problems.push(`${where}: unknown work "${workId}"`);
      }
      const spec = layouts[section.layout];
      if (!spec) {
        problems.push(`${where}: unknown layout "${section.layout}"`);
        continue;
      }
      const { min = 0, max = Infinity } = spec.works ?? {};
      if (section.works.length < min || section.works.length > max) {
        problems.push(`${where}: layout "${section.layout}" takes ${min}–${max} works, got ${section.works.length}`);
      }
      const opts = spec.options.safeParse(section.options);
      if (!opts.success) problems.push(`${where}: ${z.prettifyError(opts.error)}`);
    }
  }

  if (problems.length) throw new ContentError(problems.join('\n'));
  return { exhibition, works };
}
