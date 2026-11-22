import type { UnitSnapshot } from '../signals/types';
import { insightConfig as C } from './config';
import { ENGAGEMENT_RANK, type Engagement, type Judgement } from './types';

const LOW: Engagement[] = ['skipped', 'glanced', 'skimmed'];

/**
 * Level from dwell / expected dwell (personal pace if known). Confidence starts from
 * the distance to the nearest level boundary, then scroll speed, text progress,
 * idling and very short expected times push it up or down.
 */
export function judgeUnit(u: UnitSnapshot): Judgement {
  const expected = u.expectedPersonalMs ?? u.expectedMs;
  const ratio = expected > 0 ? u.dwellMs / expected : 0;
  const textual = u.words >= C.minTextWords;
  const bounds = textual ? C.textBounds : C.imageBounds;
  const levels = textual ? C.textLevels : C.imageLevels;

  const idx = bounds.findIndex((b) => ratio < b);
  let engagement = levels[idx === -1 ? bounds.length : idx];
  const evidence = [`dwell ${sec(u.dwellMs)} of ${sec(expected)} expected (${ratio.toFixed(2)}×)`];
  if (u.expectedPersonalMs) evidence.push('expected at personal pace');

  const logR = Math.log(Math.max(ratio, 0.01));
  const distance = Math.min(...bounds.map((b) => Math.abs(logR - Math.log(b))));
  let confidence = 1 - 0.5 * Math.exp(-distance / C.boundarySoftness);

  // long pointer rest on the image → intense
  if (u.hasImage && u.hoverMs.image >= C.intenseImageHoverMs && ENGAGEMENT_RANK[engagement] < ENGAGEMENT_RANK.intense) {
    engagement = 'intense';
    confidence = Math.min(0.95, 0.6 + u.hoverMs.image / 20_000);
    evidence.push(`pointer on image ${sec(u.hoverMs.image)}`);
  }

  const low = LOW.includes(engagement);
  if (u.relSpeed !== null) {
    evidence.push(`scrolled ${u.relSpeed.toFixed(1)}× usual speed`);
    const fast = u.relSpeed > 1.3;
    const slow = u.relSpeed < 0.8;
    if ((low && slow) || (!low && fast)) confidence -= 0.15;
    else if ((low && fast) || (!low && slow)) confidence += 0.05;
  }

  if (textual) {
    evidence.push(`reading line passed ${Math.round(u.textProgress * 100)}% of text`);
    if (!low && u.textProgress < 0.6) confidence -= 0.15;
    if (engagement === 'skipped' && u.textProgress < 0.3) confidence += 0.05;
  }

  if (u.idleStarts > 0 && ENGAGEMENT_RANK[engagement] >= ENGAGEMENT_RANK.read) {
    confidence -= 0.2;
    evidence.push('inactivity during visit');
  }

  if (expected < 4000) confidence -= 0.1;

  return { engagement, confidence: clamp(confidence, 0.3, 0.99), ratio, evidence };
}

export function describeEngagement(engagement: Engagement, label: string, textual: boolean): string {
  const q = `“${label}”`;
  switch (engagement) {
    case 'skipped':
      return `Skipped ${q}`;
    case 'glanced':
      return `Only glanced at ${q}`;
    case 'skimmed':
      return `Only skimmed ${q}`;
    case 'read':
      return `Read ${q} normally`;
    case 'looked':
      return `Looked at ${q}`;
    case 'lingered':
      return `Dwelled on ${q}`;
    case 'intense':
      return textual ? `Studied ${q} intensely` : `Looked at ${q} intensely`;
  }
}

export const sec = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
