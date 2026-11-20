/**
 * Extracts a Google Arts & Culture story into a raw JSON snapshot.
 *
 *   npm run extract -- <out-name> <story-url> [<story-url> ...]
 *
 * The snapshot keeps every slide in order with its texts, captions, asset
 * links and image URLs, plus the metadata from each linked asset page.
 * It is deliberately "dumb": turning it into exhibition content happens in
 * build-content.ts so the scrape only has to run once.
 */
import { chromium, type Page } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

export interface RawCard {
  heading: string;
  paragraphs: string[];
}

export interface RawSlide {
  index: number;
  classes: string;
  assetHrefs: string[];
  images: string[];
  /** Hidden caption of zoom slides: "<title> (<date>) by <artist>" + source line. */
  caption: { line: string; source: string } | null;
  /** Short visible captions of image slides (title + detail line). */
  shortCaptions: { title: string; detail: string }[];
  cards: RawCard[];
  paragraphs: string[];
  text: string;
}

export interface RawAsset {
  href: string;
  url: string;
  title: string;
  ogImage: string;
  details: Record<string, string>;
}

export interface RawStory {
  url: string;
  title: string;
  slides: RawSlide[];
}

const SLIDE_CONTAINER = '.sAwgQe';

async function extractStory(page: Page, url: string): Promise<RawStory> {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector(SLIDE_CONTAINER);

  // Scroll through the story so lazy parts get rendered.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
  });

  const slides = await page.evaluate((sel) => {
    const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
    const container = document.querySelector(sel)!;
    return [...container.children].map((slide, index) => {
      const assetHrefs = [...slide.querySelectorAll('a[href*="/asset/"]')].map(
        (a) => a.getAttribute('href') ?? '',
      );
      const images = [
        ...new Set(
          [...slide.querySelectorAll('[data-bgsrc], img')]
            .map((el) => el.getAttribute('data-bgsrc') || el.getAttribute('src') || '')
            .filter((src) => src.includes('googleusercontent') || src.includes('ggpht')),
        ),
      ];

      const capBox = slide.querySelector('.LkSOTc');
      const caption = capBox
        ? {
            line: clean(capBox.querySelector('p')?.textContent),
            source: clean(capBox.querySelector('strong')?.textContent),
          }
        : null;

      const shortCaptions = [...slide.querySelectorAll('.xqT1Qe')].map((t) => ({
        title: clean(t.textContent),
        detail: clean(t.parentElement?.querySelector('.YhVlZ')?.textContent ?? ''),
      }));

      const cards = [...slide.querySelectorAll('.bYQLK')].map((card) => ({
        heading: clean(card.querySelector('.Wmrbnd')?.textContent),
        paragraphs: [...card.querySelectorAll('.n7NWKb')].map((p) => clean(p.textContent)),
      }));

      const paragraphs = cards.length
        ? []
        : [...slide.querySelectorAll('p')]
            .filter((p) => !p.closest('.LkSOTc'))
            .map((p) => clean(p.textContent))
            .filter(Boolean);

      return {
        index,
        classes: slide.className,
        assetHrefs,
        images,
        caption,
        shortCaptions,
        cards,
        paragraphs,
        text: (slide as HTMLElement).innerText.trim(),
      };
    });
  }, SLIDE_CONTAINER);

  return { url, title: await page.title(), slides };
}

async function extractAsset(page: Page, href: string): Promise<RawAsset> {
  const url = new URL(href, 'https://artsandculture.google.com').toString() + '?hl=en';
  await page.goto(url, { waitUntil: 'networkidle' });
  return page.evaluate(
    ({ href, url }) => {
      const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
      const details: Record<string, string> = {};
      for (const li of document.querySelectorAll('li')) {
        const label = li.querySelector('span, b, strong');
        const text = clean(li.textContent);
        const m = /^([A-Za-z /]+):\s*(.+)$/.exec(text);
        if (label && m && m[1].length < 40) details[m[1].trim()] = m[2].trim();
      }
      return {
        href,
        url,
        title: clean(document.querySelector('h1')?.textContent),
        ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '',
        details,
      };
    },
    { href, url },
  );
}

async function main() {
  const [name, ...urls] = process.argv.slice(2);
  if (!name || urls.length === 0) {
    console.error('usage: npm run extract -- <out-name> <story-url> [...]');
    process.exit(1);
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1400, height: 900 } });
  // tsx (esbuild) wraps named functions in __name(); define it inside the page too.
  await page.addInitScript({ content: 'window.__name = (f) => f;' });

  const stories: RawStory[] = [];
  for (const url of urls) {
    console.log('story', url);
    stories.push(await extractStory(page, url));
  }

  const hrefs = [...new Set(stories.flatMap((s) => s.slides.flatMap((sl) => sl.assetHrefs)))];
  const assets: RawAsset[] = [];
  for (const href of hrefs) {
    console.log('asset', href);
    try {
      assets.push(await extractAsset(page, href));
    } catch (err) {
      console.warn('  failed', (err as Error).message);
    }
  }
  await browser.close();

  const outDir = path.resolve('scripts/.snapshot');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify({ extractedAt: new Date().toISOString(), stories, assets }, null, 2));
  console.log('wrote', file);
}

main();
