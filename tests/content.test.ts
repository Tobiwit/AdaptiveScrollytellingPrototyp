import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { validateContent } from '../src/schema/validate';
import { layoutSpecs } from '../src/layouts/registry';

const contentDir = path.resolve(import.meta.dirname, '../content');
const folders = fs
  .readdirSync(contentDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));

describe('content folders', () => {
  it('has at least one exhibition', () => {
    expect(folders.length).toBeGreaterThan(0);
  });

  for (const folder of folders) {
    it(`content/${folder} matches the schema`, () => {
      const dir = path.join(contentDir, folder);
      const { exhibition, works } = validateContent(
        readJson(path.join(dir, 'exhibition.json')),
        readJson(path.join(dir, 'works.json')),
        layoutSpecs,
      );
      expect(exhibition.id).toBe(folder);

      // Content-local images must exist (images under /media/ are gitignored, so not checked).
      for (const work of works.values()) {
        if (!work.image.src.startsWith('/') && !/^https?:/.test(work.image.src)) {
          expect(fs.existsSync(path.join(dir, work.image.src)), work.image.src).toBe(true);
        }
      }
    });
  }
});
