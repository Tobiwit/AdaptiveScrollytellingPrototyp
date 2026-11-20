import { validateContent, type LoadedExhibition } from '../schema/validate';
import { layoutSpecs } from '../layouts/registry';

const exhibitionFiles = import.meta.glob<unknown>('/content/*/exhibition.json', { eager: true, import: 'default' });
const workFiles = import.meta.glob<unknown>('/content/*/works.json', { eager: true, import: 'default' });
const imageFiles = import.meta.glob<string>('/content/*/images/*', { eager: true, query: '?url', import: 'default' });

export function availableExhibitions(): string[] {
  return Object.keys(exhibitionFiles).map((p) => p.split('/')[2]);
}

export function loadExhibition(id: string): LoadedExhibition {
  const ex = exhibitionFiles[`/content/${id}/exhibition.json`];
  if (!ex) {
    throw new Error(`No exhibition "${id}" in content/. Available: ${availableExhibitions().join(', ')}`);
  }
  const loaded = validateContent(ex, workFiles[`/content/${id}/works.json`] ?? [], layoutSpecs);

  // Resolve image paths to URLs the browser can load.
  for (const work of loaded.works.values()) {
    work.image.src = resolveImage(id, work.image.src);
  }
  return loaded;
}

function resolveImage(exhibitionId: string, src: string): string {
  if (/^https?:\/\//.test(src)) return src;
  if (src.startsWith('/')) return import.meta.env.BASE_URL + src.slice(1);
  return imageFiles[`/content/${exhibitionId}/${src}`] ?? src;
}
