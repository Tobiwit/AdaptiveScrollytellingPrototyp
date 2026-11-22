import type { ComponentType } from 'react';
import type { z } from 'zod';
import type { Chapter, Exhibition, Section, Work } from '../schema/schema';
import type { LayoutSpec } from '../schema/validate';

export interface LayoutProps<O = Record<string, unknown>> {
  exhibition: Exhibition;
  chapter: Chapter;
  section: Section;
  works: Work[];
  /** already parsed by the layout's schema */
  options: O;
}

export interface LayoutDefinition<S extends z.ZodType = z.ZodType> extends LayoutSpec {
  options: S;
  component: ComponentType<LayoutProps<z.infer<S>>>;
}

export function defineLayout<S extends z.ZodType>(def: LayoutDefinition<S>): LayoutDefinition<S> {
  return def;
}
