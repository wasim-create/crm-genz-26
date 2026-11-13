// Demo clock (test phase only).
//
// Lets a tester pretend it's another day and time, so they can see how the
// app behaves on a Monday morning, at the end of a day, next week, and so on.
// It works by shifting what `new Date()` and `Date.now()` return for the whole
// app; the clock keeps running from the chosen moment. Nothing saved is
// changed. This file must be imported before anything else (see main.tsx).
//
// Turn the whole feature off for go-live by setting DEMO_CLOCK_ENABLED = false.

export const DEMO_CLOCK_ENABLED = true;
export const SIM_KEY = 'apexdrive_sim_clock';

const RealDate = Date;
const realNow = () => RealDate.now();

function readOffset(): number {
  if (!DEMO_CLOCK_ENABLED) return 0;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SIM_KEY) : null;
    if (!raw) return 0;
    const { offset } = JSON.parse(raw) as { offset: number };
    return Number.isFinite(offset) ? offset : 0;
  } catch {
    return 0;
  }
}

const offset = readOffset();

if (offset !== 0 && typeof globalThis !== 'undefined') {
  // A Date whose "now" is shifted. Dates built from a value are untouched.
  class SimDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(realNow() + offset);
      else super(...(args as [string | number | Date]));
    }
    static now() {
      return realNow() + offset;
    }
  }
  Object.defineProperty(SimDate, 'name', { value: 'Date' });
  (globalThis as unknown as { Date: DateConstructor }).Date = SimDate as unknown as DateConstructor;
}

/** True when the app is running on a pretend time. */
export const isSimulated = () => offset !== 0;

/** The real time right now (ignores the demo clock). */
export const realTime = () => new RealDate(realNow());

/** Jump to a moment (the clock keeps running from there). Reloads the app. */
export function setSimulatedTime(target: Date) {
  const off = target.getTime() - realNow();
  try {
    if (Math.abs(off) < 60_000) localStorage.removeItem(SIM_KEY);
    else localStorage.setItem(SIM_KEY, JSON.stringify({ offset: off, setAt: realNow() }));
  } catch {
    /* storage unavailable */
  }
  window.location.reload();
}

export function backToRealTime() {
  try {
    localStorage.removeItem(SIM_KEY);
  } catch {
    /* ignore */
  }
  window.location.reload();
}
