/**
 * Turns run files into CSVs for R / Python.
 *   npm run export-runs                 # all runs/*.json → exports/
 *   npm run export-runs -- a.json b.json
 *
 * sessions.csv     one row per run
 * verdicts.csv     one row per (re)judgement, with the unit measurements behind it
 * decisions.csv    one row per adaptation
 * suggestions.csv  suggest mode: one row per offer / answer
 * conclusions.csv  long format: one row per conclusion per change
 * events.csv       raw signal events
 */
import fs from 'node:fs';
import path from 'node:path';
import type { RunFile } from '../src/recording/recorder';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const runsDir = path.join(root, 'runs');
const files = args.length ? args : fs.existsSync(runsDir) ? fs.readdirSync(runsDir).filter((f) => f.endsWith('.json')).map((f) => path.join(runsDir, f)) : [];
if (!files.length) {
  console.error('No run files. Run npm run pull-runs first, or pass files.');
  process.exit(1);
}

const runs = files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')) as RunFile).filter((r) => r.format === 'run/1');
const sec = (ms: number | null | undefined) => (ms == null ? '' : (ms / 1000).toFixed(2));

const sessions = runs.map((r) => {
  const end = r.checkpoints.at(-1);
  const s = end?.session;
  const last = r.conclusions.at(-1);
  const value = (id: string) => last?.items.find((c) => c.id === id)?.value ?? '';
  const units = end?.units ?? [];
  return {
    session_id: r.meta.sessionId,
    participant: r.meta.participant,
    condition: r.meta.condition,
    exhibition: r.meta.exhibition,
    content_hash: r.meta.contentHash,
    build: r.meta.build,
    started_at: r.meta.startedAt,
    ended_at: r.meta.endedAt,
    elapsed_s: sec(s?.elapsedMs),
    active_s: sec(s?.activeMs),
    idle_s: sec(s?.idleMs),
    hidden_s: sec(s?.hiddenMs),
    units_seen: units.filter((u) => u.visits > 0).length,
    chapters_reached: r.checkpoints.filter((c) => c.reason === 'chapter').length,
    verdicts: new Set(r.verdicts.map((v) => v.verdict.unitId)).size,
    decisions: r.decisions.length,
    calibrated_at_s: sec(r.conclusions.find((c) => c.calibrated)?.t),
    reading_pace_wpm: s?.readingPaceWpm ? Math.round(s.readingPaceWpm) : '',
    backscrolls: s?.scroll.backscrolls ?? '',
    nav_jumps: s?.navJumps ?? '',
    final_text_need: value('textNeed'),
    final_context: value('context'),
    final_visual: value('visual'),
    final_trend: value('trend'),
    viewport: s ? s.context.viewport.join('x') : '',
    tuning: JSON.stringify(r.meta.tuning),
  };
});

const verdicts = runs.flatMap((r) =>
  r.verdicts.map(({ t, verdict: v, unit: u }) => ({
    session_id: r.meta.sessionId,
    condition: r.meta.condition,
    t_s: sec(t),
    unit_id: v.unitId,
    chapter_id: v.chapterId,
    work_id: v.workId ?? '',
    kind: v.kind,
    textual: v.textual,
    passed: !!v.passed,
    engagement: v.engagement,
    confidence: v.confidence.toFixed(3),
    ratio: v.ratio.toFixed(3),
    words: u?.words ?? '',
    dwell_ms: u ? Math.round(u.dwellMs) : '',
    expected_ms: u ? Math.round(u.expectedMs) : '',
    expected_personal_ms: u?.expectedPersonalMs ? Math.round(u.expectedPersonalMs) : '',
    visits: u?.visits ?? '',
    returns: u?.returns ?? '',
    text_progress: u ? u.textProgress.toFixed(2) : '',
    rel_speed: u?.relSpeed?.toFixed(2) ?? '',
    idle_starts: u?.idleStarts ?? '',
    hover_image_ms: u ? Math.round(u.hoverMs.image) : '',
    hover_text_ms: u ? Math.round(u.hoverMs.text) : '',
    clicks: u ? Object.values(u.clicks).reduce((a, b) => a + b, 0) : '',
    opens: u?.opens ?? '',
    open_ms: u ? Math.round(u.openMs ?? 0) : '',
    expands: u?.expands ?? '',
  })),
);

const decisions = runs.flatMap((r) =>
  r.decisions.map((d) => ({
    session_id: r.meta.sessionId,
    t_s: sec(d.t),
    dimension: d.dimension,
    from: d.from,
    to: d.to,
    applies_from: d.chapterId ?? '',
    confidence: d.confidence.toFixed(3),
    via: d.via ?? 'auto',
    because: d.evidence[0] ?? '',
  })),
);

const conclusions = runs.flatMap((r) =>
  r.conclusions.flatMap((c) =>
    c.items.map((i) => ({ session_id: r.meta.sessionId, t_s: sec(c.t), calibrated: c.calibrated, id: i.id, value: i.value, confidence: i.confidence, settled: i.settled })),
  ),
);

const events = runs.flatMap((r) =>
  r.events.map(({ t, type, ...rest }) => ({
    session_id: r.meta.sessionId,
    t_s: sec(t),
    type,
    unit_id: 'unitId' in rest ? (rest.unitId ?? '') : '',
    data: JSON.stringify(rest),
  })),
);

const out = path.join(root, 'exports');
fs.mkdirSync(out, { recursive: true });
const suggestions = runs.flatMap((r) =>
  (r.suggestions ?? []).map(({ t, status, suggestion: s }) => ({
    session_id: r.meta.sessionId,
    t_s: sec(t),
    suggestion_id: s.id,
    status,
    chapter_id: s.chapterId,
    changes: s.changes.map((c) => `${c.dimension}:${c.from}>${c.to}`).join(' '),
    because: `${s.because.id}=${s.because.value}`,
    confidence: s.because.confidence.toFixed(3),
  })),
);

const tables = { sessions, verdicts, decisions, suggestions, conclusions, events };
for (const [name, rows] of Object.entries(tables)) fs.writeFileSync(path.join(out, `${name}.csv`), toCsv(rows));
console.log(`${runs.length} runs → exports/ (${Object.entries(tables).map(([n, r]) => `${n} ${r.length}`).join(', ')})`);

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n';
}
