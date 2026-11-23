import { signalConfig } from '../signals/config';
import { insightConfig } from '../insights/config';
import { conclusionConfig } from '../conclusions/config';
import { policyConfig } from '../policy/config';

/** The live config objects. Code reads them at use time, so changing them applies right away. */
export const TUNABLES = {
  signals: signalConfig,
  insights: insightConfig,
  conclusions: conclusionConfig,
  policy: policyConfig,
} as Record<string, unknown>;

export const DEFAULTS = structuredClone(TUNABLES);

export type Leaf = number | boolean | string;
/** path ("signals.band.0") → value */
export type Overrides = Record<string, Leaf>;

const KEY = 'tuning-overrides';

export function loadOverrides(): Overrides {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function saveOverrides(o: Overrides) {
  try {
    localStorage.setItem(KEY, JSON.stringify(o));
  } catch {
    /* storage blocked */
  }
  applyOverrides(o);
}

export function applyOverrides(o: Overrides) {
  reset(TUNABLES, DEFAULTS);
  for (const [path, value] of Object.entries(o)) {
    const keys = path.split('.');
    const last = keys.pop()!;
    let target = TUNABLES as Record<string, unknown>;
    for (const k of keys) {
      if (typeof target[k] !== 'object' || target[k] === null) break;
      target = target[k] as Record<string, unknown>;
    }
    target[last] = value;
  }
}

/** Applies stored overrides now and whenever another tab (e.g. /settings) changes them. */
export function startTuning() {
  applyOverrides(loadOverrides());
  addEventListener('storage', (e) => {
    if (e.key === KEY) applyOverrides(loadOverrides());
  });
}

export function getAt(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
}

function reset(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const k of Object.keys(target)) if (!(k in source)) delete target[k];
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && target[k] && typeof target[k] === 'object') reset(target[k] as Record<string, unknown>, v as Record<string, unknown>);
    else target[k] = structuredClone(v);
  }
}
