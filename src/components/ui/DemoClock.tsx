// Top-bar control for the demo clock: see the app as it would be on another
// day and time. Test phase only.

import React, { useEffect, useRef, useState } from 'react';
import { Clock, History, RotateCcw } from 'lucide-react';
import { backToRealTime, DEMO_CLOCK_ENABLED, isSimulated, setSimulatedTime } from '../../utils/simClock';
import { instantAt, wallClock } from '../../features/myplan/engine/timezones';
import { addDays } from '../../features/myplan/engine/time';

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const zoneAbbr = (d: Date, zone: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' }).formatToParts(d).find(p => p.type === 'timeZoneName')?.value ?? '';
/** Shown in the person's own time zone (the rep's region), so a tester abroad sees the rep's day. */
const label = (d: Date, zone: string) =>
  `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: zone })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone })} ${zoneAbbr(d, zone)}`;
const toInput = (d: Date, zone: string) => {
  const w = wallClock(d, zone);
  return `${w.date}T${hhmm(w.minutes)}`;
};
const at = (base: Date, zone: string, days: number, h: number, m: number) => instantAt(addDays(wallClock(base, zone).date, days), h * 60 + m, zone);
const nextWeekday = (base: Date, zone: string, weekday: number, h: number, m: number) => {
  const diff = (weekday - wallClock(base, zone).weekday + 7) % 7 || 7;
  return at(base, zone, diff, h, m);
};

/** `zone`: the signed-in person's home time zone. Times are picked and shown in it. */
export const DemoClock: React.FC<{ zone: string }> = ({ zone }) => {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [value, setValue] = useState(() => toInput(new Date(), zone));
  const box = useRef<HTMLDivElement>(null);
  const sim = isSimulated();

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (!open) return;
    setValue(toInput(new Date(), zone));
    const away = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!DEMO_CLOCK_ENABLED) return null;

  const jumps: { label: string; to: () => Date }[] = [
    { label: '+1 hour', to: () => new Date(Date.now() + 3600_000) },
    { label: '+1 day', to: () => new Date(Date.now() + 86400_000) },
    { label: 'Tomorrow 8:30 AM', to: () => at(new Date(), zone, 1, 8, 30) },
    { label: 'Today 5:30 PM', to: () => at(new Date(), zone, 0, 17, 30) },
    { label: 'Next Monday 8:30 AM', to: () => nextWeekday(new Date(), zone, 1, 8, 30) },
    { label: 'Friday 4:00 PM', to: () => nextWeekday(new Date(), zone, 5, 16, 0) },
    { label: '+1 week', to: () => new Date(Date.now() + 7 * 86400_000) },
    { label: '−1 day', to: () => new Date(Date.now() - 86400_000) }
  ];

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={sim ? `Demo clock: ${label(now, zone)}` : 'Demo clock: real time'}
        title={sim ? 'Demo clock is on' : 'Demo clock: try another day or time'}
        className={`flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 text-[13px] font-semibold transition ${
          sim ? 'border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
        }`}
      >
        {sim ? <History className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
        {sim && <span className="hidden whitespace-nowrap md:inline">{label(now, zone)}</span>}
      </button>

      {open && (
        <div role="dialog" aria-label="Demo clock" className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,360px)] space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
          <div>
            <div className="text-[15px] font-bold text-slate-900">Demo clock</div>
            <p className="mt-0.5 text-[13px] text-slate-600">
              See the app as it would be at another day and time. The clock keeps running from there. Only this browser is affected, and nothing saved is changed.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-[14px]">
            <span className="text-slate-500">{sim ? 'Pretending it is' : 'Now (real time)'}: </span>
            <span className="font-semibold text-slate-900">{label(now, zone)}</span>
          </div>

          <form
            className="flex gap-2"
            onSubmit={e => {
              e.preventDefault();
              const [day, time] = value.split('T');
              if (day && time) setSimulatedTime(instantAt(day, Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)), zone));
            }}
          >
            <input
              type="datetime-local"
              value={value}
              onChange={e => setValue(e.target.value)}
              aria-label={`Day and time to jump to (${zoneAbbr(new Date(), zone)})`}
              className="min-h-[40px] min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-2 text-[14px]"
            />
            <button type="submit" className="min-h-[40px] cursor-pointer rounded-xl bg-brand px-3 text-[14px] font-bold text-onaccent hover:bg-brand-hover">
              Go
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {jumps.map(j => (
              <button
                key={j.label}
                type="button"
                onClick={() => setSimulatedTime(j.to())}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700"
              >
                {j.label}
              </button>
            ))}
          </div>

          {sim && (
            <button
              type="button"
              onClick={backToRealTime}
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-300 py-2 text-[14px] font-semibold text-slate-800 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" /> Back to real time
            </button>
          )}
          <p className="text-[12px] text-slate-500">
            Moving forward shows deals going quiet, overdue next steps and new weeks. To rebuild the whole demo around the chosen date, use Reset demo data in Settings.
          </p>
        </div>
      )}
    </div>
  );
};
