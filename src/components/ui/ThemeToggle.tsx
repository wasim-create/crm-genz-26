// Appearance control: Auto (follows the device), Light, Dark.
// ThemeMenu is the small button in the top bar; ThemeChoice is the three big
// options used on the Settings screen.

import React, { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { ThemePref, useTheme } from '../../utils/theme';

const OPTIONS: { id: ThemePref; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'auto', label: 'Auto', hint: 'Matches your device and switches with it', icon: <Monitor className="h-4 w-4" /> },
  { id: 'light', label: 'Light', hint: 'Always light', icon: <Sun className="h-4 w-4" /> },
  { id: 'dark', label: 'Dark', hint: 'Always dark. Easier on the eyes at night', icon: <Moon className="h-4 w-4" /> }
];

export const ThemeMenu: React.FC = () => {
  const { pref, mode, setPref } = useTheme();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const now = pref === 'auto' ? `Auto, showing ${mode}` : pref === 'dark' ? 'Dark' : 'Light';

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex min-h-[40px] min-w-[40px] cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-2.5 text-slate-600 transition hover:border-slate-400"
        title={`Appearance: ${now}`}
        aria-label={`Appearance: ${now}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {mode === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>
      {open && (
        <div role="menu" aria-label="Appearance" className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {OPTIONS.map(o => (
            <button
              key={o.id}
              type="button"
              role="menuitemradio"
              aria-checked={pref === o.id}
              onClick={() => {
                setPref(o.id);
                setOpen(false);
              }}
              className={`flex w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-100 ${pref === o.id ? 'bg-blue-50' : ''}`}
            >
              <span className="mt-0.5 text-slate-600">{o.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-slate-900">{o.label}</span>
                <span className="block text-[13px] text-slate-500">{o.hint}</span>
              </span>
              {pref === o.id && <Check className="mt-0.5 h-4 w-4 text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const ThemeChoice: React.FC = () => {
  const { pref, mode, setPref } = useTheme();
  return (
    <div role="radiogroup" aria-label="Appearance" className="grid gap-2 sm:grid-cols-3">
      {OPTIONS.map(o => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={pref === o.id}
          onClick={() => setPref(o.id)}
          className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-left transition ${
            pref === o.id ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/20' : 'border-slate-200 bg-white hover:border-slate-400'
          }`}
        >
          <span className="mt-0.5 text-slate-600">{o.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-slate-900">
              {o.label}
              {o.id === 'auto' && pref === 'auto' && <span className="ml-1.5 text-[13px] font-medium text-slate-500">(now {mode})</span>}
            </span>
            <span className="block text-[13px] text-slate-500">{o.hint}</span>
          </span>
          {pref === o.id && <Check className="mt-0.5 h-4 w-4 text-blue-600" />}
        </button>
      ))}
    </div>
  );
};
