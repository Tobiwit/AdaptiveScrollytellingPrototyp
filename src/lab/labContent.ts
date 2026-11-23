import type { Chapter, Section, Work } from '../schema/schema';

// words per length step; each text gets a random length in its range
const RANGES = {
  section: [
    [18, 40],
    [55, 110],
    [130, 220],
  ],
  work: [
    [10, 25],
    [30, 60],
    [70, 130],
  ],
} as const;
const CONTEXT_RANGE = [45, 90] as const;
const QUOTE_RANGE = [16, 30] as const;

export type Dimension = 'length' | 'depth' | 'size' | 'presence';

export interface LabModule {
  key: string;
  name: string;
  layout: string;
  options?: Record<string, unknown>;
  note?: string;
  affects: Dimension[];
  section: Section;
  works: Work[];
}

type Variants = [string[], string[], string[]];

export interface LabContent {
  chapter: Chapter;
  modules: LabModule[];
}

const lengths = (v: Variants) => ({ short: v[0], long: v[2] });

export function makeLabContent(): LabContent {
  let n = 0;
  const work = (ratio: [number, number]): Work => {
    n++;
    const text = variants('work');
    return {
      id: `w${n}`,
      title: title(),
      artist: 'Artist Name',
      year: String(1840 + rand(0, 37)),
      institution: 'Collection Placeholder',
      headline: n % 2 ? undefined : title(),
      image: { src: placeholder(ratio, n), alt: `Placeholder image ${n}`, credit: 'Placeholder' },
      text: { short: [], long: text[1] },
      lengths: lengths(text),
      context: [lorem(rand(...CONTEXT_RANGE))],
      tags: {},
      size: 'M',
    };
  };
  const section = (id: string, layout: string, extra: Partial<Section> = {}, text: Variants | null = variants('section')): Section => ({
    id,
    layout,
    text: text?.[1],
    lengths: text ? lengths(text) : undefined,
    context: [lorem(rand(...CONTEXT_RANGE))],
    works: [],
    options: {},
    ...extra,
  });

  const modules: LabModule[] = [
    {
      key: 'chapter-intro',
      name: 'chapter-intro',
      layout: 'chapter-intro',
      affects: ['length', 'depth', 'presence'],
      section: section('lab-intro', 'chapter-intro', { kicker: 'Chapter 2', title: title() }),
      works: [work([4, 5])],
    },
    {
      key: 'text',
      name: 'text',
      layout: 'text',
      affects: ['length', 'depth'],
      section: section('lab-text', 'text', { title: title() }),
      works: [],
    },
    {
      key: 'text-quote',
      name: 'text · quote',
      layout: 'text',
      options: { style: 'quote' },
      note: 'quotes stay as written',
      affects: [],
      section: section('lab-quote', 'text', { text: [lorem(rand(...QUOTE_RANGE))], context: undefined, attribution: 'Artist Name, letter, 1854' }, null),
      works: [],
    },
    {
      key: 'work-focus',
      name: 'work-focus',
      layout: 'work-focus',
      affects: ['length', 'depth', 'size', 'presence'],
      section: section('lab-focus', 'work-focus', { context: undefined }, null),
      works: [work([3, 4]), work([4, 3]), work([2, 3])],
    },
    {
      key: 'gallery',
      name: 'gallery',
      layout: 'gallery',
      affects: ['length', 'depth', 'size', 'presence'],
      section: section('lab-gallery', 'gallery', { title: title() }),
      works: [work([4, 5]), work([5, 4]), work([1, 1]), work([3, 4]), work([16, 9])],
    },
    {
      key: 'compare',
      name: 'compare',
      layout: 'compare',
      affects: ['length', 'depth', 'size', 'presence'],
      section: section('lab-compare', 'compare', { title: title() }),
      works: [work([3, 4]), work([3, 4])],
    },
  ];

  for (const m of modules) m.section.works = m.works.map((w) => w.id);

  return {
    chapter: { id: 'lab', title: 'Module lab', sections: modules.map((m) => m.section) },
    modules,
  };
}

const WORDS = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore ' +
  'magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo ' +
  'consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint ' +
  'occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum curabitur pretium ' +
  'tincidunt lacus nulla gravida orci a odio nullam varius turpis et commodo pharetra est eros bibendum elit'
).split(' ');

function rand(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const pick = () => WORDS[rand(0, WORDS.length - 1)];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function lorem(count: number): string {
  const sentences: string[] = [];
  let left = count;
  while (left > 0) {
    const len = Math.min(left, rand(6, 16));
    left -= len;
    sentences.push(cap(Array.from({ length: len }, pick).join(' ')) + '.');
  }
  return sentences.join(' ');
}

function paragraphs(count: number): string[] {
  const out: string[] = [];
  let left = count;
  while (left > 0) {
    const len = left < 90 ? left : rand(45, 80);
    left -= len;
    out.push(lorem(len));
  }
  return out;
}

function variants(kind: keyof typeof RANGES): Variants {
  return RANGES[kind].map(([min, max]) => paragraphs(rand(min, max))) as Variants;
}


function title() {
  return cap(Array.from({ length: rand(2, 4) }, pick).join(' '));
}

function placeholder([w, h]: [number, number], n: number): string {
  const W = 1200;
  const H = Math.round((W * h) / w);
  const hue = (n * 47) % 360;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="100%" height="100%" fill="hsl(${hue} 18% 72%)"/>` +
    `<path d="M0 ${H} L${W * 0.35} ${H * 0.45} L${W * 0.6} ${H * 0.75} L${W * 0.78} ${H * 0.55} L${W} ${H} Z" fill="hsl(${hue} 20% 58%)"/>` +
    `<circle cx="${W * 0.75}" cy="${H * 0.25}" r="${Math.min(W, H) * 0.08}" fill="hsl(${hue} 25% 85%)"/>` +
    `<text x="50%" y="50%" text-anchor="middle" font-family="sans-serif" font-size="${W * 0.05}" fill="hsl(${hue} 20% 30%)">Work ${n} · ${w}:${h}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
