/**
 * Downloads all runs from Supabase into runs/<sessionId>.json.
 *   npm run pull-runs
 * Needs SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local (the secret key bypasses RLS, never ship it).
 */
import fs from 'node:fs';
import path from 'node:path';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local');
  process.exit(1);
}

const OUT = path.resolve(import.meta.dirname, '..', 'runs');
const PAGE = 20;
fs.mkdirSync(OUT, { recursive: true });

let offset = 0;
let total = 0;
for (;;) {
  const res = await fetch(`${url}/rest/v1/runs?select=id,data&order=created_at&limit=${PAGE}&offset=${offset}`, {
    headers: { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}) },
  });
  if (!res.ok) {
    console.error(`Supabase answered ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const rows = (await res.json()) as { id: string; data: unknown }[];
  for (const row of rows) fs.writeFileSync(path.join(OUT, `${row.id}.json`), JSON.stringify(row.data));
  total += rows.length;
  if (rows.length < PAGE) break;
  offset += PAGE;
}
console.log(`${total} runs → ${path.relative(process.cwd(), OUT)}/`);
