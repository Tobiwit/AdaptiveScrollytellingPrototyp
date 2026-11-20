/**
 * Turns a Google Arts & Culture snapshot (from extract-gac.ts) into an
 * exhibition content folder and downloads the images into assets/.
 *
 *   npm run build-content            # writes content/courbetorial/, downloads images
 *   npm run build-content -- --no-images
 *
 * The slide → layout mapping is rule based:
 *   section title slide      → new chapter + `chapter-intro` (first one: `hero`)
 *   text slides              → `text`  (consecutive ones merged)
 *   quote slides             → `text` with style "quote"
 *   artwork "zoom" slides    → works in a `work-focus` (consecutive ones merged)
 *   single image slides      → `gallery` (consecutive ones merged)
 *   two-image slides         → `compare`, taking the text slides that follow
 *   last zoom slide matching `closingHeading` → closing chapter
 * Text is copied verbatim; nothing is written by hand. Missing data becomes "TODO".
 */
import fs from 'node:fs';
import path from 'node:path';
import type { RawAsset, RawSlide, RawStory } from './extract-gac';
import type { Chapter, Exhibition, Section, Work } from '../src/schema/schema';

// ---- Exhibition-specific settings ------------------------------------------

const CONFIG = {
  id: 'courbetorial',
  snapshot: 'scripts/.snapshot/courbetorial.json',
  title: 'I, Gustave Courbet. Painter and Rebel',
  subtitle: '“Courbetorial” – the digital exhibition guide',
  locale: 'en',
  closingHeading: /Welcome to the Artist/i,
  creditsLead: 'Content from “Courbetorial”, Museum Folkwang, on Google Arts & Culture.',
  imageSize: '=s1800',
};

// ---- Helpers ----------------------------------------------------------------

const slug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
const year4 = (s: string) => /\d{4}/.exec(s)?.[0] ?? '';
const sentenceCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
const kind = (slide: RawSlide) => slide.classes.split(' ')[0];
const isAudioCard = (heading: string) => heading.startsWith('The audio files');
const stripSource = (s: string) => s.replace(/^Original Source:\s*/, '').trim();
const isUrl = (s: string) => /^https?:\/\//.test(s);

const SLIDE = {
  title: 'TZYb6c',
  text: 'NupC9',
  quote: 'KHkXr',
  zoom: 'ChZpMb',
  image: 'rA01vb',
  pair: 'ENfHAb',
  credits: 'CaU1xe',
};

interface Draft extends Work {
  key: string;
  imageUrl: string;
}

// ---- Conversion -------------------------------------------------------------

function convert(stories: RawStory[], assets: RawAsset[]) {
  const assetByHref = new Map(assets.map((a) => [a.href, a]));
  const works = new Map<string, Draft>(); // key → work
  const usedIds = new Set<string>();
  const warnings: string[] = [];
  let credits: string[] = [];

  function addWork(w: Omit<Draft, 'id' | 'tags' | 'size' | 'text'> & { paragraphs: string[] }): Draft {
    const existing = works.get(w.key);
    if (existing) {
      existing.text.long.push(...w.paragraphs);
      if (!existing.headline && w.headline) existing.headline = w.headline;
      return existing;
    }
    const base = w.title.startsWith('TODO') ? `untitled-${year4(w.year)}` : slug(w.title) || 'work';
    let id = base;
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
    usedIds.add(id);
    const { paragraphs, ...rest } = w;
    const draft: Draft = {
      ...rest,
      id,
      text: { short: paragraphs.length ? ['TODO: short text'] : [], long: [...paragraphs] },
      tags: {},
      size: 'M',
    };
    works.set(w.key, draft);
    return draft;
  }

  /** Work from a linked asset page (title, image and single-image slides). */
  function workFromAsset(href: string, slide: RawSlide, storyUrl: string): Draft | null {
    const asset = assetByHref.get(href);
    if (!asset) {
      warnings.push(`asset ${href} missing from snapshot`);
      return null;
    }
    const d = asset.details;
    let artist = d['Creator'] ?? '';
    let year = d['Date Created'] ?? d['Date'] ?? '';
    if (!year) {
      // "Gustave Courbet, 1852"
      const m = /^(.*),\s*(\d{4}.*)$/.exec(artist);
      if (m) [, artist, year] = m;
    }
    // "Courbet, Gustave" → "Gustave Courbet"
    const lastFirst = /^([^,\d]+),\s*([^,\d]+)$/.exec(artist);
    if (lastFirst) artist = `${lastFirst[2]} ${lastFirst[1]}`;
    const title = d['Title'] ?? asset.title;

    const usable = (s?: string) => (s && !isUrl(s) && !/^(CC0|Public Domain)$/i.test(s) ? s.trim() : '');
    const fromCollection = /From the collection of:\s*([^\n]+?)\s*$/.exec(slide.text)?.[1];
    const capSource = slide.caption ? stripSource(slide.caption.source) : '';
    const institution =
      usable(capSource) || usable(fromCollection) || usable(d['Original Source']) || usable(d['Rights']) || usable(d['Provider']);

    return addWork({
      key: `${slug(title || href)}|${year4(year)}`,
      title: title || 'TODO: title',
      artist: artist || 'TODO: artist',
      year,
      institution: institution || 'TODO: institution',
      medium: d['Medium'],
      image: {
        src: '',
        alt: '',
        credit: slide.caption?.source || institution || d['Credits'] || '',
        sourceUrl: asset.url.replace(/\?hl=en$/, '') || storyUrl,
      },
      imageUrl: asset.ogImage,
      paragraphs: [],
    });
  }

  /** Work from an artwork "zoom" slide (no asset link, caption + text cards). */
  function workFromZoom(slide: RawSlide, storyUrl: string): Draft | null {
    const cards = slide.cards.filter((c) => !isAudioCard(c.heading));
    if (!cards.length || !slide.caption) return null;
    const source = slide.caption.source;
    const line = slide.caption.line.endsWith(source) ? slide.caption.line.slice(0, -source.length) : slide.caption.line;
    const m = /^(.*) \(([^()]*)\) by (.*)$/.exec(line.trim());
    if (!m) warnings.push(`could not parse caption "${line}"`);
    const [, capTitle = line, capDate = '', artist = 'TODO: artist'] = m ?? [];

    // The card heading is usually the English title + year ("The Wave, 1870").
    const heading = cards[0].heading;
    const hm = /^(.*?),\s*((?:c\.\s*)?\d{4}[^,]*)$/.exec(heading);
    const title = hm ? hm[1] : capTitle;
    const year = hm ? hm[2] : capDate;
    const headline = !hm && heading && heading !== capTitle ? heading : undefined;
    const institution = stripSource(source);

    return addWork({
      key: `${slug(capTitle)}|${year4(capDate)}`,
      title,
      headline,
      artist,
      year,
      institution: isUrl(institution) ? 'TODO: institution' : institution,
      image: { src: '', alt: '', credit: source, sourceUrl: storyUrl },
      imageUrl: slide.images[0] ?? '',
      paragraphs: cards.flatMap((c) => c.paragraphs),
    });
  }

  const chapters: Chapter[] = [];
  let chapter: Chapter | null = null;
  let last = null as Section | null; // section that consecutive slides may extend
  let lastKind = '';

  const push = (section: Omit<Section, 'id' | 'works' | 'options'> & Partial<Section>) => {
    if (!chapter) throw new Error('content before the first section title slide');
    const full: Section = { works: [], options: {}, ...section, id: `${chapter.id}-${chapter.sections.length + 1}` };
    chapter.sections.push(full);
    last = full;
    return full;
  };

  for (const story of stories) {
    const storyUrl = story.url.replace(/\?hl=en$/, '');
    for (const slide of story.slides) {
      const k = kind(slide);
      if (k === SLIDE.credits) {
        if (!credits.length) {
          const t = slide.text.split('Credits: All media')[0].replace('Credits: Story', '');
          credits = t.split('\n').map((s) => s.trim()).filter(Boolean);
        }
        break;
      }
      if (/CONTIN|BACK TO PART/.test(slide.text)) continue;

      if (k === SLIDE.title) {
        const [rawTitle, second = ''] = slide.paragraphs;
        const isIntro = !/^Section \d+/.test(second);
        const title = sentenceCase(rawTitle);
        chapter = {
          id: slug(title),
          label: isIntro ? 'Intro' : second.replace('Section ', ''),
          title,
          sections: [],
        };
        chapters.push(chapter);
        const cover = slide.assetHrefs[0] ? workFromAsset(slide.assetHrefs[0], slide, storyUrl) : null;
        if (isIntro) {
          push({ layout: 'hero', kicker: title, text: slide.paragraphs.slice(1), works: cover ? [cover.id] : [] });
        } else {
          push({ layout: 'chapter-intro', kicker: second, title, text: [], works: cover ? [cover.id] : [] });
        }
      } else if (k === SLIDE.text) {
        // Text right after a chapter intro or a compare belongs to it.
        if (last && ['chapter-intro', 'compare', 'text'].includes(last.layout) && lastKind !== SLIDE.quote) {
          last.text = [...(last.text ?? []), ...slide.paragraphs];
        } else {
          push({ layout: 'text', text: slide.paragraphs });
        }
      } else if (k === SLIDE.quote) {
        const lines = slide.text.split('\n').map((s) => s.trim()).filter(Boolean);
        const end = lines.findIndex((l) => l.endsWith('”'));
        const hasAttribution = end >= 0 && end < lines.length - 1;
        push({
          layout: 'text',
          options: { style: 'quote' },
          text: hasAttribution ? lines.slice(0, end + 1) : lines,
          attribution: hasAttribution ? lines.slice(end + 1).join(' ') : undefined,
        });
      } else if (k === SLIDE.zoom) {
        const isClosing = slide.cards.some((c) => CONFIG.closingHeading.test(c.heading));
        const work = workFromZoom(slide, storyUrl);
        if (!work) {
          warnings.push(`skipped slide ${slide.index} of ${storyUrl} (audio only)`);
          continue;
        }
        if (isClosing) {
          const heading = slide.cards[0].heading;
          work.headline = undefined;
          const paragraphs = work.text.long;
          work.text = { short: [], long: [] };
          chapter = { id: 'closing', label: 'End', title: heading, sections: [] };
          chapters.push(chapter);
          push({ layout: 'closing', title: heading, text: paragraphs, works: [work.id] });
        } else if (last?.layout === 'work-focus' && lastKind === SLIDE.zoom) {
          if (!last.works.includes(work.id)) last.works.push(work.id);
        } else {
          push({ layout: 'work-focus', works: [work.id] });
        }
      } else if (k === SLIDE.image) {
        const work = slide.assetHrefs[0] ? workFromAsset(slide.assetHrefs[0], slide, storyUrl) : null;
        if (!work) continue;
        if (last?.layout === 'gallery' && lastKind === SLIDE.image) last.works.push(work.id);
        else push({ layout: 'gallery', works: [work.id] });
      } else if (k === SLIDE.pair) {
        const pair = slide.assetHrefs.map((h) => workFromAsset(h, slide, storyUrl)).filter((w): w is Draft => !!w);
        if (pair.length === 2) push({ layout: 'compare', works: pair.map((w) => w.id), text: [] });
        else push({ layout: 'gallery', works: pair.map((w) => w.id) });
      } else {
        warnings.push(`skipped slide ${slide.index} (${k}) of ${storyUrl}: "${slide.text.slice(0, 60)}"`);
        continue;
      }
      lastKind = k;
    }
  }

  // A chapter cover that is also the first work of the next work-focus would
  // show the same image twice in a row; keep it only in the work-focus.
  for (const c of chapters) {
    const [intro, next] = c.sections;
    if (intro?.layout === 'chapter-intro' && next?.layout === 'work-focus' && intro.works[0] === next.works[0]) {
      intro.works = [];
    }
  }

  // Images and alt text.
  for (const w of works.values()) {
    w.image.src = `/media/${CONFIG.id}/${w.id}.jpg`;
    w.image.alt = `${w.title}${w.artist && !w.artist.startsWith('TODO') ? `, ${w.artist}` : ''}${w.year ? `, ${w.year}` : ''}`;
    if (!w.image.credit) w.image.credit = w.institution;
  }

  const exhibition: Exhibition = {
    id: CONFIG.id,
    title: CONFIG.title,
    subtitle: CONFIG.subtitle,
    locale: CONFIG.locale,
    theme: { colors: {}, fonts: {} },
    credits: [CONFIG.creditsLead, ...credits],
    sources: stories.map((s, i) => ({ label: `Part ${i + 1} on Google Arts & Culture`, url: s.url.replace(/\?hl=en$/, '') })),
    defaults: { size: 'M', textVariant: 'long' },
    chapters,
  };
  return { exhibition, works: [...works.values()], warnings };
}

async function download(works: Draft[], force: boolean) {
  const dir = path.resolve('assets', CONFIG.id);
  fs.mkdirSync(dir, { recursive: true });
  for (const w of works) {
    const file = path.join(dir, `${w.id}.jpg`);
    if (!force && fs.existsSync(file)) continue;
    if (!w.imageUrl) {
      console.warn(`no image URL for ${w.id}`);
      continue;
    }
    const url = (w.imageUrl.startsWith('//') ? 'https:' + w.imageUrl : w.imageUrl).replace(/=[^/]*$/, '') + CONFIG.imageSize;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`download failed for ${w.id}: ${res.status}`);
      continue;
    }
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log('image', w.id);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const snapshot = JSON.parse(fs.readFileSync(CONFIG.snapshot, 'utf8'));
  const { exhibition, works, warnings } = convert(snapshot.stories, snapshot.assets);

  const outDir = path.resolve('content', CONFIG.id);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'exhibition.json'), JSON.stringify(exhibition, null, 2) + '\n');
  fs.writeFileSync(
    path.join(outDir, 'works.json'),
    JSON.stringify(works.map(({ key: _k, imageUrl: _u, ...w }) => w), null, 2) + '\n',
  );
  console.log(`${exhibition.chapters.length} chapters, ${works.length} works → ${outDir}`);
  for (const w of warnings) console.warn('warning:', w);

  if (!args.includes('--no-images')) await download(works, args.includes('--force'));
}

main();
