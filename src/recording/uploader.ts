import type { RunRecorder } from './recorder';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined;
const EVERY_MS = 30_000;
const KEEPALIVE_MAX = 60_000; // browsers cap keepalive bodies at 64 KB

export type UploadStatus = { state: 'idle' | 'saving' | 'saved' | 'failed'; at: number | null };

/** Only study links (?pid=) upload, and only when Supabase is configured. */
export function uploadEnabled() {
  return !!URL_ && !!KEY && new URLSearchParams(location.search).has('pid');
}

/** Saves the whole run every 30 s while it changes, when the tab is hidden and on leaving. */
export class RunUploader {
  status: UploadStatus = { state: 'idle', at: null };
  private listeners = new Set<() => void>();
  private lastKey = '';
  private timer = 0;
  private teardown: (() => void)[] = [];

  constructor(private readonly recorder: RunRecorder) {}

  start() {
    this.timer = window.setInterval(() => this.save(), EVERY_MS);
    const onHidden = () => document.visibilityState === 'hidden' && this.save();
    const onLeave = () => this.save(true);
    document.addEventListener('visibilitychange', onHidden);
    addEventListener('pagehide', onLeave);
    this.teardown.push(
      () => clearInterval(this.timer),
      () => document.removeEventListener('visibilitychange', onHidden),
      () => removeEventListener('pagehide', onLeave),
    );
  }

  stop() {
    for (const off of this.teardown.splice(0)) off();
    this.save(true);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getStatus = () => this.status;

  async save(leaving = false) {
    const run = this.recorder.toJSON();
    const key = [run.events.length, run.verdicts.length, run.conclusions.length, run.decisions.length, run.suggestions?.length ?? 0, run.checkpoints.length].join();
    if (key === this.lastKey || !run.events.length) return;
    const body = JSON.stringify({
      p_id: run.meta.sessionId,
      p_participant: run.meta.participant,
      p_condition: run.meta.condition,
      p_exhibition: run.meta.exhibition,
      p_build: run.meta.build,
      p_data: run,
    });
    const prevKey = this.lastKey;
    this.lastKey = key; // hidden + pagehide fire together on leaving
    this.set('saving');
    try {
      const res = await fetch(`${URL_}/rest/v1/rpc/save_run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: KEY!, ...(KEY!.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}) },
        body,
        keepalive: leaving && body.length < KEEPALIVE_MAX,
      });
      if (!res.ok) throw new Error(`${res.status}`);
      this.set('saved');
    } catch {
      this.lastKey = prevKey;
      this.set('failed');
    }
  }

  private set(state: UploadStatus['state']) {
    this.status = { state, at: Date.now() };
    for (const l of this.listeners) l();
  }
}
