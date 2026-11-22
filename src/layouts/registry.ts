import type { LayoutSpec } from '../schema/validate';
import type { LayoutDefinition } from './types';
import hero from './hero';
import chapterIntro from './chapter-intro';
import text from './text';
import workFocus from './work-focus';
import gallery from './gallery';
import compare from './compare';
import closing from './closing';

// layout name in content JSON → module
export const layouts: Record<string, LayoutDefinition> = {
  hero,
  'chapter-intro': chapterIntro,
  text,
  'work-focus': workFocus,
  gallery,
  compare,
  closing,
} as Record<string, LayoutDefinition>;

export const layoutSpecs: Record<string, LayoutSpec> = layouts;
