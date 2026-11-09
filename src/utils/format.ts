// Dates, times and amounts the way people read them: "Wed, Nov 11",
// "11:00 AM", "3 days ago". Never show raw computer dates on screen.

const dayOf = (iso: string) => new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);

/** "Wed, Nov 11" (adds the year when it isn't this year). */
export function formatDay(iso?: string | null, today = new Date()): string {
  if (!iso) return '—';
  const d = dayOf(iso);
  if (isNaN(d.getTime())) return '—';
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** "Nov 11" or "Nov 11, 2025". */
export function formatShortDay(iso?: string | null, today = new Date()): string {
  if (!iso) return '—';
  const d = dayOf(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }) });
}

/** "11:00" → "11:00 AM". */
export function formatClock(hhmm?: string | null): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h)) return hhmm;
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${ap}`;
}

/** "Wed, Nov 11 · 11:00 AM". */
export function formatDayTime(dateISO?: string | null, hhmm?: string | null): string {
  const day = formatDay(dateISO);
  return hhmm ? `${day} · ${formatClock(hhmm)}` : day;
}

/** "Today", "Yesterday", "3 days ago", "in 2 days", "Nov 11". */
export function formatRelative(iso?: string | null, now = new Date()): string {
  if (!iso) return 'Never';
  const d = dayOf(iso);
  if (isNaN(d.getTime())) return '—';
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((b - a) / 86400000);
  if (days === 0) return 'Today';
  if (days === -1) return 'Yesterday';
  if (days === 1) return 'Tomorrow';
  if (days < 0 && days > -30) return `${-days} days ago`;
  if (days > 0 && days < 30) return `in ${days} days`;
  return formatShortDay(iso, now);
}

/** Whole days since a date (0 if missing or in the future). */
export function daysSince(iso?: string | null, now = new Date()): number | null {
  if (!iso) return null;
  const d = dayOf(iso);
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400000));
}

export const formatMoney = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n % 1 ? 2 : 0 });

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const matches = (q: string, ...fields: (string | undefined | null)[]) => {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return fields.some(f => (f ?? '').toLowerCase().includes(s));
};

/** "Last contact 3 days ago" / "Last contact on Sep 22" / "No contact yet". */
export function lastContactText(iso?: string | null, now = new Date()): string {
  if (!iso) return 'No contact yet';
  const r = formatRelative(iso, now);
  return /^(Today|Yesterday|Tomorrow|in |\d)/.test(r) ? `Last contact ${r.toLowerCase()}` : `Last contact on ${r}`;
}

/** A full timestamp in the viewer's time: "Wed, Nov 11 · 2:35 PM". */
export function formatStamp(iso?: string | null, timeZone?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const day = d.toLocaleDateString('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric', ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }) });
  const time = d.toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}
