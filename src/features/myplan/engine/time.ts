// Date and time helpers. All plan dates are local calendar dates (YYYY-MM-DD)
// and all times are 24h "HH:MM" strings in the dealership's local time.

export const toMin = (t: string | undefined, fallback = 600): number => {
  if (!t) return fallback;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h)) return fallback;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
};

export const toHHMM = (min: number): string => {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const format12h = (t: string | number): string => {
  const min = typeof t === 'number' ? t : toMin(t);
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const dh = h % 12 === 0 ? 12 : h % 12;
  return `${dh}:${String(m).padStart(2, '0')} ${ampm}`;
};

export const formatDuration = (min: number): string => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
};

export const todayISO = (now: Date = new Date()): string => toISODate(now);

export const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const parseISODate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};

export const addDays = (iso: string, days: number): string => {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

export const dayOfWeek = (iso: string): number => parseISODate(iso).getDay();

export const isWeekend = (iso: string): boolean => {
  const d = dayOfWeek(iso);
  return d === 0 || d === 6;
};

/** Monday of the week containing `iso`. */
export const startOfWeek = (iso: string): string => {
  const dow = dayOfWeek(iso);
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(iso, diff);
};

export const weekDates = (iso: string, includeWeekend = false): string[] => {
  const monday = startOfWeek(iso);
  const count = includeWeekend ? 7 : 5;
  return Array.from({ length: count }, (_, i) => addDays(monday, i));
};

export const nextWeekday = (iso: string): string => {
  let d = addDays(iso, 1);
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
};

export const formatDayLong = (iso: string): string =>
  parseISODate(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

export const formatDayShort = (iso: string): string =>
  parseISODate(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export const formatWeekday = (iso: string): string =>
  parseISODate(iso).toLocaleDateString('en-US', { weekday: 'long' });

export const relativeDayLabel = (iso: string, today: string): string => {
  if (iso === today) return 'Today';
  if (iso === addDays(today, 1)) return 'Tomorrow';
  if (iso === addDays(today, -1)) return 'Yesterday';
  return formatDayShort(iso);
};

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
