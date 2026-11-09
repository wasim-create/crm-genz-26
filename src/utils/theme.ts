// Light / dark / auto.
//
// Auto follows the device and changes live when the device does (for example
// at sunset). If a browser gives no preference at all, Auto falls back to the
// clock: dark from 7pm to 7am.

import { useSyncExternalStore } from 'react';

export type ThemePref = 'auto' | 'light' | 'dark';
export type ThemeMode = 'light' | 'dark';

export const THEME_KEY = 'apexdrive_theme';

/** What the device says: true = dark, false = light, null = no preference given. */
export type SystemScheme = boolean | null;

export function resolveTheme(pref: ThemePref, systemDark: SystemScheme, hour: number): ThemeMode {
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  if (systemDark !== null) return systemDark ? 'dark' : 'light';
  return hour >= 19 || hour < 7 ? 'dark' : 'light';
}

export function parsePref(raw: string | null | undefined): ThemePref {
  return raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : 'auto';
}

// ---------------------------------------------------------------- browser side

const hasWindow = typeof window !== 'undefined';

function readSystem(): SystemScheme {
  if (!hasWindow || !window.matchMedia) return null;
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return true;
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return false;
  return null;
}

function readPref(): ThemePref {
  try {
    return parsePref(localStorage.getItem(THEME_KEY));
  } catch {
    return 'auto';
  }
}

let pref: ThemePref = hasWindow ? readPref() : 'auto';
let mode: ThemeMode = resolveTheme(pref, hasWindow ? readSystem() : null, new Date().getHours());
const listeners = new Set<() => void>();
let snapshot = { pref, mode };

function apply(fade: boolean) {
  const root = document.documentElement;
  if (fade) {
    root.classList.add('theme-fade');
    window.setTimeout(() => root.classList.remove('theme-fade'), 300);
  }
  root.classList.toggle('dark', mode === 'dark');
  root.classList.toggle('light', mode === 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', mode === 'dark' ? '#0b1120' : '#ffffff');
}

function refresh(fade: boolean) {
  const next = resolveTheme(pref, readSystem(), new Date().getHours());
  const changed = next !== mode || snapshot.pref !== pref;
  mode = next;
  if (changed) {
    snapshot = { pref, mode };
    apply(fade);
    listeners.forEach(l => l());
  }
}

export function setThemePref(next: ThemePref) {
  pref = next;
  try {
    if (next === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, next);
  } catch {
    /* private mode: the choice lasts until the page closes */
  }
  refresh(true);
}

if (hasWindow) {
  apply(false);
  const watch = window.matchMedia?.('(prefers-color-scheme: dark)');
  watch?.addEventListener?.('change', () => refresh(true));
  // Clock fallback and sleeping-laptop catch-up
  window.setInterval(() => refresh(true), 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh(true);
  });
  // Another tab changed the choice
  window.addEventListener('storage', e => {
    if (e.key === THEME_KEY) {
      pref = readPref();
      refresh(true);
    }
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => snapshot;

/** The saved choice and what is showing right now. */
export function useTheme() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { pref: s.pref, mode: s.mode, setPref: setThemePref };
}
