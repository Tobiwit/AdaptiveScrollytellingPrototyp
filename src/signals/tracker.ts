import { createEventBus } from './bus';
import { signalConfig as C } from './config';
import {
  PARTS,
  type Part,
  type PartRecord,
  type SessionSnapshot,
  type SignalEvent,
  type SignalSnapshot,
  type UnitMeta,
  type UnitSnapshot,
  type WorkSnapshot,
} from './types';

interface UnitState {
  meta: UnitMeta;
  el: HTMLElement | null;
  docTop: number;
  dwellMs: number;
  bandMs: number;
  visits: number;
  currentVisitMs: number;
  returns: number;
  leftBackward: number;
  skips: number;
  textProgress: number;
  speedSum: number;
  speedN: number;
  movingMs: number;
  hoverMs: PartRecord;
  hoverEntries: PartRecord;
  clicks: PartRecord;
  idleStarts: number;
  firstFocusAt: number | null;
  lastFocusAt: number | null;
  paceSampled: boolean;
}

type EventInput = SignalEvent extends unknown ? DistributiveOmit<SignalEvent, 't'> & { t?: number } : never;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

const zeroParts = (): PartRecord => ({ image: 0, caption: 0, text: 0, other: 0 });

export const unitIdFor = (sectionId: string, workId?: string) => `${sectionId}/${workId ?? 'text'}`;

export function expectedDwellMs(meta: Pick<UnitMeta, 'words' | 'hasImage' | 'size'>, wpm = C.readingWpm) {
  return (meta.hasImage ? C.imageMs[meta.size ?? 'M'] : 0) + (meta.words / wpm) * 60_000;
}

/**
 * Collects behavioural signals for the whole session: scroll speed, scroll-backs,
 * dwell vs expected dwell per unit, tab visibility, idleness, pointer and clicks.
 *
 * It samples every `tickMs` and attributes everything to the single focused unit.
 * Nothing leaves the browser; the snapshot is the basis for adaptation later.
 */
export class SignalTracker {
  /** Notable events as they happen (for a future adaptive policy and logging). */
  readonly events = createEventBus<SignalEvent>();

  private units = new Map<string, UnitState>();
  private listeners = new Set<() => void>();
  private log: SignalEvent[] = [];
  private snapshot: SignalSnapshot;
  private running = false;
  private timer = 0;
  private teardown: (() => void)[] = [];

  private readonly t0 = performance.now();
  private readonly startedAt = new Date().toISOString();
  private lastTick = 0;
  private lastY = 0;
  private lastActivity = 0;
  private visible = true;
  private windowFocused = true;
  private idle = false;
  private idleSince = 0;
  private focusId: string | null = null;
  /** Focus from scroll position alone (ignoring the pointer). */
  private bandFocusId: string | null = null;
  private time = { activeMs: 0, idleMs: 0, hiddenMs: 0 };

  private scroll = {
    velocity: 0,
    speed: 0,
    recent: null as number | null,
    n: 0,
    mean: 0,
    m2: 0,
    distanceVh: 0,
    backscrolls: 0,
    backscrollVh: 0,
  };
  private episode: { fromId: string | null; distVh: number; lastUpAt: number } | null = null;
  private navUntil = -Infinity;

  private pointer = {
    type: null as string | null,
    inside: false,
    unitId: null as string | null,
    part: null as Part | null,
    lastMove: -Infinity,
    segStart: 0,
  };
  private pointerEngagedMs = 0;
  private pointerOnFocusMs = 0;
  private clicks = 0;
  private navJumps = 0;
  private paceSamples: number[] = [];

  constructor() {
    this.snapshot = this.buildSnapshot(0);
  }

  // ---- lifecycle -----------------------------------------------------------

  start() {
    if (this.running) return;
    this.running = true;
    const listen = (target: Window | Document, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn, opts);
      this.teardown.push(() => target.removeEventListener(type, fn, opts));
    };
    const activity = () => this.markActivity();
    for (const type of ['scroll', 'wheel', 'keydown', 'touchstart', 'pointerdown']) {
      listen(window, type, activity, { passive: true });
    }
    listen(window, 'pointermove', (e) => this.onPointerMove(e as PointerEvent), { passive: true });
    listen(document, 'pointerout', (e) => {
      if (!(e as PointerEvent).relatedTarget) {
        this.endHover(this.now());
        this.pointer.inside = false;
        this.pointer.unitId = null;
        this.pointer.part = null;
      }
    });
    listen(document, 'click', (e) => this.onClick(e as MouseEvent), { capture: true });
    listen(document, 'visibilitychange', () => {
      this.visible = document.visibilityState === 'visible';
      this.emit({ type: 'visibility', visible: this.visible });
      if (this.visible) this.markActivity();
    });
    listen(window, 'focus', () => {
      this.windowFocused = true;
      this.emit({ type: 'window-focus', focused: true });
    });
    listen(window, 'blur', () => {
      this.windowFocused = false;
      this.emit({ type: 'window-focus', focused: false });
    });

    this.visible = document.visibilityState === 'visible';
    this.windowFocused = document.hasFocus();
    this.lastY = scrollY;
    this.lastTick = this.now();
    this.lastActivity = this.now();
    this.timer = window.setInterval(() => this.tick(), C.tickMs);
  }

  stop() {
    this.running = false;
    clearInterval(this.timer);
    for (const off of this.teardown.splice(0)) off();
  }

  // ---- units ---------------------------------------------------------------

  /** Registers (or updates) a unit's element. Stats survive re-registration. */
  register(el: HTMLElement, meta: UnitMeta): () => void {
    let state = this.units.get(meta.unitId);
    if (!state) {
      state = {
        meta,
        el,
        docTop: 0,
        dwellMs: 0,
        bandMs: 0,
        visits: 0,
        currentVisitMs: 0,
        returns: 0,
        leftBackward: 0,
        skips: 0,
        textProgress: 0,
        speedSum: 0,
        speedN: 0,
        movingMs: 0,
        hoverMs: zeroParts(),
        hoverEntries: zeroParts(),
        clicks: zeroParts(),
        idleStarts: 0,
        firstFocusAt: null,
        lastFocusAt: null,
        paceSampled: false,
      };
      this.units.set(meta.unitId, state);
    }
    state.meta = meta;
    state.el = el;
    return () => {
      if (state.el === el) state.el = null;
    };
  }

  getElement(unitId: string): HTMLElement | null {
    return this.units.get(unitId)?.el ?? null;
  }

  // ---- React store interface -----------------------------------------------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  // ---- input handlers --------------------------------------------------------

  private now() {
    return performance.now() - this.t0;
  }

  private emit(event: EventInput) {
    const e = { t: Math.round(event.t ?? this.now()), ...event } as SignalEvent;
    this.log.push(e);
    if (this.log.length > C.eventLogSize) this.log.shift();
    this.events.emit(e);
  }

  private markActivity() {
    const t = this.now();
    this.lastActivity = t;
    if (this.idle) {
      this.idle = false;
      this.emit({ type: 'idle-end', idleMs: Math.round(t - this.idleSince) });
    }
  }

  private locate(target: EventTarget | null): { unitId: string | null; part: Part | null } {
    const el = target instanceof Element ? target : null;
    if (!el || el.closest('[data-signals-ignore]')) return { unitId: null, part: null };
    const unitEl = el.closest('[data-unit]');
    if (!unitEl) return { unitId: null, part: null };
    const partEl = el.closest('[data-part]');
    const part = partEl && unitEl.contains(partEl) ? (partEl.getAttribute('data-part') as Part) : 'other';
    return { unitId: unitEl.getAttribute('data-unit'), part: PARTS.includes(part) ? part : 'other' };
  }

  private onPointerMove(e: PointerEvent) {
    const t = this.now();
    this.markActivity();
    const p = this.pointer;
    p.inside = true;
    p.lastMove = t;
    p.type = e.pointerType;
    const { unitId, part } = this.locate(e.target);
    if (unitId !== p.unitId || part !== p.part) {
      this.endHover(t);
      p.unitId = unitId;
      p.part = part;
      p.segStart = t;
      const u = unitId ? this.units.get(unitId) : undefined;
      if (u && part) u.hoverEntries[part]++;
    }
  }

  private endHover(t: number) {
    const p = this.pointer;
    if (p.unitId && p.part && t - p.segStart >= C.hoverMinMs) {
      this.emit({ type: 'hover', unitId: p.unitId, part: p.part, ms: Math.round(t - p.segStart), t: p.segStart });
    }
  }

  private onClick(e: MouseEvent) {
    const target = e.target instanceof Element ? e.target : null;
    if (!target || target.closest('[data-signals-ignore]')) return;
    const anchor = target.closest('a[href^="#"]');
    if (anchor) {
      this.navJumps++;
      this.navUntil = this.now() + C.navLockMs;
      this.emit({ type: 'nav-jump', href: anchor.getAttribute('href') ?? '' });
    }
    const { unitId, part } = this.locate(target);
    this.clicks++;
    const u = unitId ? this.units.get(unitId) : undefined;
    if (u && part) u.clicks[part]++;
    const desc = target.tagName.toLowerCase() + (target.id ? `#${target.id}` : '');
    this.emit({ type: 'click', unitId, part, target: desc });
  }

  // ---- sampling ------------------------------------------------------------

  private tick() {
    const t = this.now();
    const rawDt = t - this.lastTick;
    const dt = Math.min(rawDt, 1000); // background tabs tick slowly
    this.lastTick = t;
    const vh = innerHeight;
    const y = scrollY;
    const dyVh = (y - this.lastY) / vh;
    this.lastY = y;
    const navigating = t < this.navUntil;

    // Scroll speed
    const s = this.scroll;
    const velocity = dt > 0 ? dyVh / (dt / 1000) : 0;
    const speed = Math.abs(velocity);
    const a = 1 - Math.exp(-dt / 300);
    s.velocity += (velocity - s.velocity) * a;
    s.speed += (speed - s.speed) * a;
    s.distanceVh += Math.abs(dyVh);
    const moving = speed > C.movingVhPerS;
    if (moving && !navigating) {
      // Welford running mean/variance of moving speed = this visitor's baseline
      s.n++;
      const d = speed - s.mean;
      s.mean += d / s.n;
      s.m2 += d * (speed - s.mean);
      const r = 1 - Math.exp(-dt / C.recentTauMs);
      s.recent = s.recent === null ? speed : s.recent + (speed - s.recent) * r;
    }

    // Visibility and idleness
    const focus = this.focusId ? this.units.get(this.focusId) : undefined;
    const idleThreshold = this.idleThreshold(focus);
    if (!this.idle && this.visible && t - this.lastActivity > idleThreshold) {
      this.idle = true;
      this.idleSince = t;
      if (focus) focus.idleStarts++;
      this.emit({ type: 'idle-start', unitId: this.focusId, afterMs: Math.round(t - this.lastActivity) });
    }
    const active = this.visible && !this.idle;
    if (!this.visible) this.time.hiddenMs += rawDt;
    else if (this.idle) this.time.idleMs += rawDt;
    else this.time.activeMs += dt;

    // Geometry: which units are in the focus band?
    const bandTop = vh * C.band[0];
    const bandBottom = vh * C.band[1];
    const line = vh * C.readingLine;
    const candidates: { u: UnitState; overlap: number }[] = [];
    for (const u of this.units.values()) {
      if (!u.el) continue;
      const r = u.el.getBoundingClientRect();
      if (r.height === 0) continue;
      u.docTop = r.top + y;
      const overlap = Math.min(r.bottom, bandBottom) - Math.max(r.top, bandTop);
      if (overlap > 0) {
        candidates.push({ u, overlap });
        if (active) u.bandMs += dt;
        const textEl = u.el.querySelector<HTMLElement>('[data-part="text"]');
        if (textEl) {
          const tr = textEl.getBoundingClientRect();
          const progress = Math.max(0, Math.min(1, (line - tr.top) / Math.max(tr.height, 1)));
          u.textProgress = Math.max(u.textProgress, progress);
        }
      }
    }

    // Band focus: the candidate with most text, else most overlap with the band.
    const prevBand = this.bandFocusId ? this.units.get(this.bandFocusId) : undefined;
    let bandFocus: UnitState | undefined;
    if (candidates.length) {
      bandFocus = candidates.sort((x, z) => z.u.meta.words - x.u.meta.words || z.overlap - x.overlap)[0].u;
    } else if (prevBand?.el) {
      // Between units (e.g. the gaps in work-focus): keep it while it's still on screen.
      const r = prevBand.el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) bandFocus = prevBand;
    }
    this.bandFocusId = bandFocus?.meta.unitId ?? null;

    // Focus: a moving pointer on a unit wins (gaze proxy), otherwise the band focus.
    const pointerEngaged = this.pointer.inside && t - this.pointer.lastMove < C.pointerEngagedMs;
    const pointerUnit = pointerEngaged && this.pointer.unitId ? this.units.get(this.pointer.unitId) : undefined;
    const next = pointerUnit?.el ? pointerUnit : bandFocus;
    const nextId = next?.meta.unitId ?? null;
    if (nextId !== this.focusId) {
      if (focus) this.exitFocus(focus, t);
      if (next) this.enterFocus(next, t);
      this.focusId = nextId;
    }

    // Dwell and scroll behaviour while focused
    if (next && active) {
      next.dwellMs += dt;
      next.currentVisitMs += dt;
      if (moving && !navigating) {
        next.speedSum += speed;
        next.speedN++;
        next.movingMs += dt;
      }
    }

    // Scroll-backs
    if (!navigating) {
      if (velocity < -C.movingVhPerS) {
        if (!this.episode) this.episode = { fromId: this.focusId, distVh: 0, lastUpAt: t };
        this.episode.distVh += -dyVh;
        this.episode.lastUpAt = t;
      } else if (this.episode && (velocity > C.movingVhPerS || t - this.episode.lastUpAt > C.backscrollEndMs)) {
        this.endBackscroll();
      }
    } else {
      this.episode = null;
    }

    // Pointer as gaze proxy
    if (active && pointerEngaged && this.pointer.unitId && this.pointer.part) {
      this.pointerEngagedMs += dt;
      const pu = this.units.get(this.pointer.unitId);
      if (pu) pu.hoverMs[this.pointer.part] += dt;
      // Compared with the band focus, so this measures whether the pointer follows the reading position.
      if (this.pointer.unitId === this.bandFocusId) this.pointerOnFocusMs += dt;
    } else if (active && pointerEngaged) {
      this.pointerEngagedMs += dt;
    }

    this.snapshot = this.buildSnapshot(t);
    for (const l of this.listeners) l();
  }

  private idleThreshold(focus?: UnitState) {
    return Math.max(C.idleMinMs, focus ? C.idleExpectedFactor * expectedDwellMs(focus.meta) : 0);
  }

  private enterFocus(u: UnitState, t: number) {
    u.visits++;
    u.firstFocusAt ??= t;
    const { unitId, workId, sectionId } = u.meta;
    this.emit({ type: 'focus-enter', unitId, workId, sectionId });
  }

  private exitFocus(u: UnitState, t: number) {
    u.lastFocusAt = t;
    const { unitId, workId, sectionId, words } = u.meta;
    const visitMs = Math.round(u.currentVisitMs);
    this.emit({ type: 'focus-exit', unitId, workId, sectionId, visitMs });

    const expected = expectedDwellMs(u.meta);
    if (u.visits === 1 && expected >= C.skipMinExpectedMs && visitMs < C.skipRatio * expected) {
      u.skips++;
      this.emit({ type: 'skip', unitId, visitMs, expectedMs: Math.round(expected) });
    }

    // Reading pace from units that were read to the end.
    if (!u.paceSampled && words >= C.paceMinWords && u.textProgress >= C.paceMinProgress) {
      const readingMs = u.dwellMs - (u.meta.hasImage ? C.imageMs[u.meta.size ?? 'M'] : 0);
      const wpm = readingMs > 0 ? words / (readingMs / 60_000) : Infinity;
      if (wpm >= C.paceRangeWpm[0] && wpm <= C.paceRangeWpm[1]) {
        this.paceSamples.push(wpm);
        u.paceSampled = true;
      }
    }
    u.currentVisitMs = 0;
  }

  private endBackscroll() {
    const ep = this.episode;
    this.episode = null;
    if (!ep || ep.distVh < C.backscrollMinVh) return;
    this.scroll.backscrolls++;
    this.scroll.backscrollVh += ep.distVh;
    const from = ep.fromId ? this.units.get(ep.fromId) : undefined;
    const to = this.focusId ? this.units.get(this.focusId) : undefined;
    if (from) from.leftBackward++;
    if (to && to !== from) to.returns++;
    this.emit({
      type: 'backscroll',
      distanceVh: Math.round(ep.distVh * 100) / 100,
      fromUnitId: ep.fromId,
      toUnitId: this.focusId,
    });
  }

  // ---- snapshot ------------------------------------------------------------

  private buildSnapshot(t: number): SignalSnapshot {
    const s = this.scroll;
    const baseline = s.n >= 4 ? s.mean : null;
    const baselineStd = s.n >= 4 ? Math.sqrt(s.m2 / (s.n - 1)) : null;
    const pace = median(this.paceSamples);

    const units: UnitSnapshot[] = [...this.units.values()]
      .sort((a, b) => a.docTop - b.docTop)
      .map((u, order) => {
        const expectedMs = expectedDwellMs(u.meta);
        const avgSpeed = u.speedN ? u.speedSum / u.speedN : null;
        return {
          ...u.meta,
          order,
          expectedMs,
          expectedPersonalMs: pace ? expectedDwellMs(u.meta, pace) : null,
          dwellMs: u.dwellMs,
          readingRatio: expectedMs > 0 ? u.dwellMs / expectedMs : 0,
          bandMs: u.bandMs,
          visits: u.visits,
          currentVisitMs: u.currentVisitMs,
          returns: u.returns,
          leftBackward: u.leftBackward,
          skips: u.skips,
          textProgress: u.textProgress,
          avgSpeed,
          relSpeed: avgSpeed !== null && baseline ? avgSpeed / baseline : null,
          movingShare: u.dwellMs > 0 ? u.movingMs / u.dwellMs : null,
          hoverMs: { ...u.hoverMs },
          hoverEntries: { ...u.hoverEntries },
          clicks: { ...u.clicks },
          idleStarts: u.idleStarts,
          firstFocusAt: u.firstFocusAt,
          lastFocusAt: u.lastFocusAt,
        };
      });

    const works = new Map<string, WorkSnapshot>();
    for (const u of units) {
      if (!u.workId) continue;
      const w = works.get(u.workId) ?? {
        workId: u.workId,
        label: u.label,
        unitIds: [],
        dwellMs: 0,
        expectedMs: 0,
        readingRatio: 0,
        bandMs: 0,
        visits: 0,
        returns: 0,
        imageHoverMs: 0,
        clicks: 0,
      };
      w.unitIds.push(u.unitId);
      w.dwellMs += u.dwellMs;
      w.expectedMs += u.expectedMs;
      w.bandMs += u.bandMs;
      w.visits += u.visits;
      w.returns += u.returns;
      w.imageHoverMs += u.hoverMs.image;
      w.clicks += PARTS.reduce((n, p) => n + u.clicks[p], 0);
      w.readingRatio = w.expectedMs > 0 ? w.dwellMs / w.expectedMs : 0;
      works.set(u.workId, w);
    }

    const session: SessionSnapshot = {
      startedAt: this.startedAt,
      elapsedMs: t,
      ...this.time,
      visible: this.visible,
      windowFocused: this.windowFocused,
      idle: this.idle,
      active: this.visible && !this.idle,
      msSinceActivity: t - this.lastActivity,
      idleThresholdMs: this.idleThreshold(this.focusId ? this.units.get(this.focusId) : undefined),
      focusUnitId: this.focusId,
      bandFocusUnitId: this.bandFocusId,
      scroll: {
        y: typeof scrollY === 'number' ? scrollY : 0,
        velocity: s.velocity,
        speed: s.speed,
        baseline,
        baselineStd,
        relSpeed: baseline ? s.speed / baseline : null,
        recentRelSpeed: baseline && s.recent !== null ? s.recent / baseline : null,
        distanceVh: s.distanceVh,
        backscrolls: s.backscrolls,
        backscrollVh: s.backscrollVh,
        navigating: t < this.navUntil,
      },
      pointer: {
        type: this.pointer.type,
        inside: this.pointer.inside,
        engaged: this.pointer.inside && t - this.pointer.lastMove < C.pointerEngagedMs,
        unitId: this.pointer.unitId,
        part: this.pointer.part,
        onFocusShare: this.pointerEngagedMs > 2000 ? this.pointerOnFocusMs / this.pointerEngagedMs : null,
      },
      clicks: this.clicks,
      navJumps: this.navJumps,
      readingPaceWpm: pace,
      paceSamples: this.paceSamples.length,
      context: {
        viewport: [innerWidth, innerHeight],
        devicePixelRatio,
        coarsePointer: matchMedia('(pointer: coarse)').matches,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        language: navigator.language,
      },
    };

    return {
      session,
      focus: units.find((u) => u.unitId === this.focusId) ?? null,
      units,
      works: [...works.values()],
      events: [...this.log],
    };
  }
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
