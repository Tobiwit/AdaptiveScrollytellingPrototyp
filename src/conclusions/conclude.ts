import { signalConfig } from '../signals/config';
import { conclusionConfig as K } from './config';
import type { SignalSnapshot } from '../signals/types';
import type { Engagement, InsightState, UnitVerdict } from '../insights/types';

/** Layer 3: standing beliefs about the run, from verdicts and session signals. */
export type ConclusionId =
  | 'textNeed'
  | 'context'
  | 'trend'
  | 'pace'
  | 'visual'
  | 'topWork'
  | 'interests'
  | 'strain'
  | 'presence'
  | 'trust'
  | 'navigation'
  | 'progress';

export interface Conclusion {
  id: ConclusionId;
  label: string;
  value: string;
  /** 0–1, null = no meter */
  meter: number | null;
  confidence: number;
  /** amount of evidence (verdicts, samples) */
  basis: number;
  trend: 'up' | 'down' | null;
  /** confident enough to act on */
  settled: boolean;
  evidence: string[];
  /** e.g. "needs tags" */
  waiting?: string;
}

export interface RunConclusions {
  items: Conclusion[];
  /** 0–1, for image size */
  workScores: Record<string, number>;
  calibrated: boolean;
  /** preview only, nothing is applied */
  wouldDo: string[];
}

const SCORE = K.score as Record<Engagement, number>;

export function concludeRun(signals: SignalSnapshot, insights: InsightState, prev: RunConclusions | null, hasTags: boolean): RunConclusions {
  const s = signals.session;
  const verdicts = Object.values(insights.verdicts).sort((a, b) => a.at - b.at);
  const texts = verdicts.filter((v) => v.textual);
  const unitById = new Map(signals.units.map((u) => [u.unitId, u]));
  const items: Omit<Conclusion, 'settled'>[] = [];

  // Text need
  const a = weighted(texts);
  const recentVsAll = texts.length >= 6 ? a.mean - mean(texts.map((v) => SCORE[v.engagement])) : 0;
  items.push({
    id: 'textNeed',
    label: 'text need',
    value: texts.length ? tri(a.mean, K.textNeed.short, K.textNeed.long, ['short', 'standard', 'long']) : '–',
    meter: texts.length ? (a.mean + 1) / 2 : null,
    confidence: evidence(a.weight) * (1 - 0.5 * a.std),
    basis: texts.length,
    trend: arrow(recentVsAll, 0.2),
    evidence: [`${texts.length} texts judged, score ${a.mean.toFixed(2)}`, counts(texts)],
  });

  // Context: section texts vs the works' own texts
  const ctx = weighted(texts.filter((v) => v.kind === 'text'));
  const own = weighted(texts.filter((v) => v.kind === 'work'));
  const rel = own.n ? ctx.mean - own.mean : 0;
  items.push({
    id: 'context',
    label: 'context',
    value: !ctx.n ? '–' : ctx.mean < K.context.low || rel < K.context.lowVsWorks ? 'low' : ctx.mean > K.context.high && rel > K.context.highVsWorks ? 'high' : 'medium',
    meter: ctx.n ? (ctx.mean + 1) / 2 : null,
    confidence: evidence(ctx.weight) * (1 - 0.5 * ctx.std),
    basis: ctx.n,
    trend: null,
    evidence: [`context texts ${ctx.mean.toFixed(2)} (${ctx.n})`, `work texts ${own.mean.toFixed(2)} (${own.n})`],
  });

  // Trend: last 6 verdicts vs the ones before
  const recent = verdicts.slice(-6);
  const earlier = verdicts.slice(0, -6);
  let trendScore = 0;
  if (verdicts.length >= 8) {
    const skip = (vs: UnitVerdict[]) => vs.filter((v) => v.engagement === 'skipped').length / vs.length;
    trendScore =
      mean(recent.map((v) => SCORE[v.engagement])) -
      mean(earlier.map((v) => SCORE[v.engagement])) -
      0.3 * (skip(recent) - skip(earlier)) +
      (insights.profile.scrollTempo === 'fast' ? -0.15 : insights.profile.scrollTempo === 'slow' ? 0.1 : 0);
  }
  items.push({
    id: 'trend',
    label: 'trend',
    value: verdicts.length < 8 ? '–' : tri(trendScore, K.trend.falling, K.trend.rising, ['falling', 'stable', 'rising']),
    meter: verdicts.length < 8 ? null : clamp((trendScore + 1) / 2),
    confidence: verdicts.length < 8 ? 0 : evidence(verdicts.length / 2) * Math.min(1, 0.4 + Math.abs(trendScore)),
    basis: verdicts.length,
    trend: arrow(trendScore, 0.25),
    evidence: [`recent ${recent.length} vs earlier ${earlier.length} verdicts`, `scroll tempo ${insights.profile.scrollTempo}`],
  });

  // Pace (only calibrates expected dwell)
  const wpm = s.readingPaceWpm;
  items.push({
    id: 'pace',
    label: 'pace',
    value: wpm ? `${Math.round(wpm)} wpm` : '–',
    meter: wpm ? clamp(wpm / 400) : null,
    confidence: wpm ? Math.min(0.95, 0.4 + 0.1 * s.paceSamples) : 0,
    basis: s.paceSamples,
    trend: null,
    evidence: wpm ? [`${(wpm / signalConfig.readingWpm).toFixed(2)}× the default ${signalConfig.readingWpm} wpm`] : ['no text read to the end yet'],
  });

  // Visual: images vs texts, pointer only if trusted
  const img = weighted(verdicts.filter((v) => !v.textual && v.kind === 'work'));
  const pointerOk = insights.profile.pointerFollowsReading !== false;
  const hoverImg = sum(signals.units.map((u) => u.hoverMs.image));
  const hoverTxt = sum(signals.units.map((u) => u.hoverMs.text));
  const ptr = pointerOk && hoverImg + hoverTxt > 3000 ? (hoverImg - hoverTxt) / (hoverImg + hoverTxt) : 0;
  const visual = clamp((img.n && a.n ? (img.mean - a.mean) / 2 : 0) + K.visual.pointerWeight * ptr, -1, 1);
  items.push({
    id: 'visual',
    label: 'visual',
    value: img.n + a.n < 3 ? '–' : tri(visual, K.visual.textLed, K.visual.imageLed, ['text-led', 'balanced', 'image-led']),
    meter: img.n + a.n < 3 ? null : (visual + 1) / 2,
    confidence: Math.min(0.9, evidence(img.weight + a.weight)),
    basis: img.n + a.n,
    trend: null,
    evidence: [`images ${img.mean.toFixed(2)} (${img.n}) vs texts ${a.mean.toFixed(2)} (${a.n})`, pointerOk ? `pointer image share ${pct((ptr + 1) / 2)}` : 'pointer ignored'],
  });

  // Interest per work
  const workScores: Record<string, number> = {};
  const workLabels: Record<string, string> = {};
  for (const v of verdicts) {
    if (!v.workId) continue;
    const u = unitById.get(v.unitId);
    const base = ((SCORE[v.engagement] + 1) / 2) * 0.7;
    const extra =
      Math.min(0.15, (u?.returns ?? 0) * 0.075) +
      Math.min(0.1, sum(Object.values(u?.clicks ?? {})) * 0.05) +
      Math.min(0.15, (u?.hoverMs.image ?? 0) / 20_000);
    workScores[v.workId] = Math.max(workScores[v.workId] ?? 0, Math.min(1, base + extra));
    workLabels[v.workId] = v.label;
  }
  const top = Object.entries(workScores).sort((x, y) => y[1] - x[1]);
  items.push({
    id: 'topWork',
    label: 'top work',
    value: top.length ? short(workLabels[top[0][0]]) : '–',
    meter: top.length ? top[0][1] : null,
    confidence: evidence(top.length / 2),
    basis: top.length,
    trend: null,
    evidence: top.slice(0, 3).map(([id, sc]) => `${short(workLabels[id], 28)} ${sc.toFixed(2)}`),
  });

  // Interests by tag
  items.push({
    id: 'interests',
    label: 'interests',
    value: '–',
    meter: null,
    confidence: 0,
    basis: 0,
    trend: null,
    evidence: [],
    waiting: hasTags ? 'not built yet' : 'needs tags',
  });

  // Strain
  const textUnits = signals.units.filter((u) => u.words >= 15 && u.visits > 0);
  const rereads = sum(textUnits.map((u) => u.returns));
  const stuck = texts.filter((v) => SCORE[v.engagement] >= 0.5 && (unitById.get(v.unitId)?.textProgress ?? 1) < 0.6).length;
  const idleOnText = sum(textUnits.map((u) => u.idleStarts));
  const strain =
    (wpm && wpm < 0.75 * signalConfig.readingWpm ? 0.35 : 0) +
    Math.min(0.3, (rereads / Math.max(1, texts.length)) * 0.6) +
    Math.min(0.25, stuck * 0.1) +
    Math.min(0.15, idleOnText * 0.08);
  items.push({
    id: 'strain',
    label: 'strain',
    value: texts.length < 3 ? '–' : strain < 0.25 ? 'none' : strain < 0.5 ? 'possible' : 'likely',
    meter: texts.length < 3 ? null : clamp(strain),
    // easily confused with interest, so capped
    confidence: texts.length < 3 ? 0 : Math.min(0.8, evidence(texts.length / 2) * (0.5 + strain / 2)),
    basis: texts.length,
    trend: null,
    evidence: [`re-reads ${rereads}`, `long but unfinished ${stuck}`, `idle on text ${idleOnText}`, wpm ? `pace ${Math.round(wpm)} wpm` : 'pace unknown'],
  });

  // Presence
  const presence = !s.visible ? 'away' : s.idle ? 'away' : s.msSinceActivity < 15_000 && s.focusUnitId ? 'engaged' : 'passive';
  items.push({
    id: 'presence',
    label: 'presence',
    value: presence,
    meter: presence === 'engaged' ? 1 : presence === 'passive' ? 0.5 : 0,
    confidence: 0.95,
    basis: 1,
    trend: null,
    evidence: [!s.visible ? 'tab hidden' : s.idle ? 'no input' : `last input ${Math.round(s.msSinceActivity / 1000)}s ago`],
  });

  // Trust
  const pf = insights.profile.pointerFollowsReading;
  const trustPts = (pf === true ? 1 : pf === false ? -1 : 0) + (s.context.coarsePointer ? -1 : 0) + (verdicts.length >= 10 ? 1 : verdicts.length < 4 ? -1 : 0) + (s.navJumps > 3 ? -0.5 : 0);
  items.push({
    id: 'trust',
    label: 'trust',
    value: trustPts >= 1 ? 'high' : trustPts <= -1 ? 'low' : 'medium',
    meter: clamp((trustPts + 2) / 4),
    confidence: 0.75,
    basis: verdicts.length,
    trend: null,
    evidence: [`pointer ${pf === null ? 'unknown' : pf ? 'usable' : 'not usable'}`, s.context.coarsePointer ? 'touch device' : 'mouse', `${verdicts.length} verdicts`, `${s.navJumps} nav jumps`],
  });

  // Navigation
  const bs = s.scroll.backscrolls;
  items.push({
    id: 'navigation',
    label: 'navigation',
    value: verdicts.length < 3 ? '–' : s.navJumps >= 2 ? 'jumping' : bs >= 2 && bs / verdicts.length >= 0.15 ? 'revisiting' : 'linear',
    meter: null,
    confidence: evidence(verdicts.length / 2),
    basis: verdicts.length,
    trend: null,
    evidence: [`${bs} scroll-backs`, `${s.navJumps} nav jumps`],
  });

  // Progress
  const reached = Math.max(-1, ...signals.units.filter((u) => u.visits > 0 || u.bandMs > 0).map((u) => u.order));
  const progress = signals.units.length ? (reached + 1) / signals.units.length : 0;
  const projected = progress > 0.05 ? s.activeMs / progress : null;
  items.push({
    id: 'progress',
    label: 'progress',
    value: `${pct(progress)} · ${clock(s.activeMs)}${projected ? ` → ~${Math.round(projected / 60_000)} min` : ''}`,
    meter: progress,
    confidence: 0.95,
    basis: reached + 1,
    trend: null,
    evidence: [`unit ${reached + 1} of ${signals.units.length}`, 'projected total = active time ÷ progress'],
  });

  // Settling with hysteresis.
  const settled: Conclusion[] = items.map((c) => {
    const was = prev?.items.find((p) => p.id === c.id);
    const ok = c.value !== '–' && !c.waiting && (c.confidence >= K.settle || (!!was?.settled && was.value === c.value && c.confidence >= K.unsettle));
    return { ...c, confidence: clamp(c.confidence), settled: ok };
  });

  const calibrated = verdicts.length >= K.calibration.verdicts && s.activeMs >= K.calibration.activeMs;
  return { items: settled, workScores, calibrated, wouldDo: preview(settled, calibrated, top.length ? workLabels[top[0][0]] : null, top[0]?.[1] ?? 0) };
}

function preview(items: Conclusion[], calibrated: boolean, topLabel: string | null, topScore: number): string[] {
  const get = (id: ConclusionId) => items.find((c) => c.id === id)!;
  const is = (id: ConclusionId, value: string) => get(id).settled && get(id).value === value;
  if (get('presence').value === 'away') return ['pause: visitor away'];
  if (!calibrated) return ['calibrating, no adaptation yet'];
  const out: string[] = [];
  if (is('textNeed', 'short') && get('trend').value !== 'rising') out.push('suggest shorter texts at next chapter');
  if (is('textNeed', 'long')) out.push('offer longer texts at next chapter');
  if (is('context', 'high') && get('textNeed').value !== 'short') out.push('offer the context layer');
  if (is('context', 'low')) out.push('collapse context passages');
  if (is('strain', 'likely')) out.push('suggest simpler language');
  if (is('visual', 'image-led')) out.push('enlarge upcoming images');
  if (topLabel && topScore >= 0.75) out.push(`enlarge works similar to “${short(topLabel, 24)}” (needs tags)`);
  return out.length ? out : ['no change'];
}

function weighted(vs: UnitVerdict[]) {
  const n = vs.length;
  const w = vs.map((v, i) => v.confidence * 0.5 ** ((n - 1 - i) / K.halfLife));
  const weight = sum(w);
  const m = weight ? sum(vs.map((v, i) => w[i] * SCORE[v.engagement])) / weight : 0;
  const variance = weight ? sum(vs.map((v, i) => w[i] * (SCORE[v.engagement] - m) ** 2)) / weight : 0;
  return { mean: m, std: Math.sqrt(variance), weight, n };
}

/** ~0.63 at 2, ~0.92 at 5 */
const evidence = (w: number) => 1 - Math.exp(-w / 2);
const tri = (x: number, lo: number, hi: number, [a, b, c]: string[]) => (x < lo ? a : x > hi ? c : b);
const arrow = (d: number, t: number): 'up' | 'down' | null => (d > t ? 'up' : d < -t ? 'down' : null);
const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const short = (s: string, n = 18) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const clock = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
function counts(vs: UnitVerdict[]) {
  const c: Record<string, number> = {};
  for (const v of vs) c[v.engagement] = (c[v.engagement] ?? 0) + 1;
  return Object.entries(c).map(([k, n]) => `${k} ${n}`).join(', ') || 'none';
}
