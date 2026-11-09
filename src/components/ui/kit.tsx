// The shared look for every screen: one set of headings, buttons, cards,
// badges, stat tiles and one search / filter / sort bar. Plain words,
// sentence case, one main (blue) action per screen.

import React, { useEffect, useState } from 'react';
import { ArrowUpDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { useBackLayer } from '../../utils/backStack';

// ---------------------------------------------------------------- layout

export const Page: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`mx-auto w-full max-w-[1400px] space-y-5 ${className}`}>{children}</div>
);

export const PageHeader: React.FC<{
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, subtitle, icon, actions }) => (
  <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
    <div className="min-w-0">
      <h1 className="flex items-center gap-2.5 text-[26px] font-extrabold leading-tight tracking-tight text-slate-900">
        {icon && <span className="text-blue-600">{icon}</span>}
        {title}
      </h1>
      {subtitle && <p className="mt-1 max-w-3xl text-[15px] text-slate-600">{subtitle}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 lg:pt-1">{actions}</div>}
  </header>
);

export const SectionTitle: React.FC<{ children: React.ReactNode; right?: React.ReactNode; className?: string }> = ({ children, right, className = '' }) => (
  <div className={`flex items-center justify-between gap-2 ${className}`}>
    <h2 className="text-[17px] font-bold text-slate-900">{children}</h2>
    {right}
  </div>
);

// ---------------------------------------------------------------- buttons

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'attention';

const BUTTON: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-onaccent hover:bg-brand-hover shadow-xs disabled:bg-slate-300',
  secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
  danger: 'bg-white text-rose-700 border border-rose-300 hover:bg-rose-50',
  success: 'bg-success text-onaccent hover:bg-success-hover shadow-xs',
  attention: 'bg-danger text-onaccent hover:bg-danger-hover'
};

export const Btn: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md'; icon?: React.ReactNode }
> = ({ variant = 'secondary', size = 'md', icon, className = '', children, ...rest }) => (
  <button
    type="button"
    className={`inline-flex shrink-0 cursor-pointer items-center whitespace-nowrap justify-center gap-1.5 rounded-xl font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed ${BUTTON[variant]} ${
      size === 'sm' ? 'min-h-[32px] px-2.5 text-[13px]' : 'min-h-[40px] px-3.5 text-[14px]'
    } ${className}`}
    {...rest}
  >
    {icon}
    {children}
  </button>
);

// ---------------------------------------------------------------- surfaces

export const Panel: React.FC<React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }> = ({ interactive, className = '', children, ...rest }) => (
  <div
    className={`rounded-2xl border border-slate-200 bg-white ${interactive ? 'cursor-pointer transition hover:border-blue-400 hover:shadow-md' : ''} ${className}`}
    {...rest}
  >
    {children}
  </div>
);

export type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'teal';

const TONE: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-50 text-blue-800',
  green: 'bg-emerald-50 text-emerald-800',
  amber: 'bg-amber-50 text-amber-900',
  red: 'bg-rose-50 text-rose-800',
  violet: 'bg-violet-50 text-violet-800',
  teal: 'bg-teal-50 text-teal-800'
};

export const Badge: React.FC<{ tone?: Tone; children: React.ReactNode; className?: string; title?: string }> = ({ tone = 'neutral', children, className = '', title }) => (
  <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold ${TONE[tone]} ${className}`}>
    {children}
  </span>
);

/** A number with a label. Pass onClick to make it a filter (it shows pressed when active). */
export const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
  active?: boolean;
  onClick?: () => void;
}> = ({ label, value, hint, tone = 'neutral', active, onClick }) => {
  const colour: Record<Tone, string> = {
    neutral: 'text-slate-900',
    blue: 'text-blue-700',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-rose-700',
    violet: 'text-violet-700',
    teal: 'text-teal-700'
  };
  const body = (
    <>
      <div className="text-[13px] font-medium text-slate-600">{label}</div>
      <div className={`mt-0.5 text-[26px] font-extrabold leading-tight ${colour[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[13px] text-slate-500">{hint}</div>}
    </>
  );
  if (!onClick) return <Panel className="p-4">{body}</Panel>;
  return (
    <button
      type="button"
      aria-pressed={!!active}
      onClick={onClick}
      className={`cursor-pointer rounded-2xl border bg-white p-4 text-left transition hover:border-blue-400 ${active ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-slate-200'}`}
    >
      {body}
    </button>
  );
};

export const EmptyState: React.FC<{ title: string; hint?: React.ReactNode; action?: React.ReactNode }> = ({ title, hint, action }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
    <div className="text-[16px] font-semibold text-slate-800">{title}</div>
    {hint && <div className="mt-1 text-[14px] text-slate-500">{hint}</div>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

/** Small segmented switch (e.g. Board / Table, Weekly / Monthly). */
export function Switch<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: React.ReactNode; title?: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-slate-100 p-1">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition ${
            value === o.value ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A simple centred dialog. Click outside or Cancel to close. */
/** Gives an overlay a Back-button step while it is on screen. */
export const BackLayer: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  useBackLayer(true, onBack);
  return null;
};

export const Dialog: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-scrim/50 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={e => { e.stopPropagation(); onClose(); }}>
    <BackLayer onBack={onClose} />
    <Panel className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} space-y-4 p-6 shadow-2xl`} onClick={e => e.stopPropagation()}>
      <h2 className="text-[18px] font-bold text-slate-900">{title}</h2>
      {children}
    </Panel>
  </div>
);

// ---------------------------------------------------------------- toolbar

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}
export interface ToolbarFilter {
  id: string;
  /** Shown as the "any" option, e.g. "All stages". */
  allLabel: string;
  value: string;
  options: FilterOption[];
  onChange: (v: string) => void;
  /** The starting value, if not "all" (it doesn't count as a filter). */
  defaultValue?: string;
}
export interface ToolbarChip {
  id: string;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  /** Red when it flags a problem (e.g. "no next step"). */
  tone?: 'default' | 'attention';
}

/**
 * One bar for every list: search, a few filters, quick chips, sort,
 * a result count and "Clear" when anything is set.
 */
export const Toolbar: React.FC<{
  search?: { value: string; onChange: (v: string) => void; placeholder: string };
  filters?: ToolbarFilter[];
  chips?: ToolbarChip[];
  sort?: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void };
  count?: React.ReactNode;
  onClear?: () => void;
  right?: React.ReactNode;
}> = ({ search, filters = [], chips = [], sort, count, onClear, right }) => {
  const active = !!search?.value || filters.some(f => f.value !== (f.defaultValue ?? 'all')) || chips.some(c => c.active);
  const setCount = filters.filter(f => f.value !== (f.defaultValue ?? 'all')).length + chips.filter(c => c.active).length;
  const [open, setOpen] = useState(false);
  // On phones the filters fold away behind one button.
  const fold = open ? '' : 'max-md:hidden';
  return (
    <Panel className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {search && (
          <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search.value}
              onChange={e => search.onChange(e.target.value)}
              placeholder={search.placeholder}
              aria-label={search.placeholder}
              className="min-h-[40px] w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-[14px] focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            />
          </label>
        )}
        {(filters.length > 0 || chips.length > 0 || sort) && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(o => !o)}
            className={`inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-[14px] font-semibold md:hidden ${setCount ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-300 bg-white text-slate-700'}`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters{setCount ? ` (${setCount})` : ''}
          </button>
        )}
        {filters.map(f => (
          <select
            key={f.id}
            aria-label={f.allLabel}
            value={f.value}
            onChange={e => f.onChange(e.target.value)}
            className={`${fold} min-h-[40px] cursor-pointer rounded-xl border px-3 text-[14px] font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 max-md:w-full ${
              f.value !== (f.defaultValue ?? 'all') ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            <option value="all">{f.allLabel}</option>
            {f.options.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
                {o.count !== undefined ? ` (${o.count})` : ''}
              </option>
            ))}
          </select>
        ))}
        {sort && (
          <label className={`${fold} inline-flex items-center gap-1.5 text-[14px] text-slate-600`}>
            <ArrowUpDown className="h-4 w-4" />
            <span className="sr-only">Sort by</span>
            <select
              aria-label="Sort by"
              value={sort.value}
              onChange={e => sort.onChange(e.target.value)}
              className="min-h-[40px] cursor-pointer rounded-xl border border-slate-300 bg-white px-3 text-[14px] font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              {sort.options.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="ml-auto flex items-center gap-2">
          {count && <span className="text-[14px] text-slate-600">{count}</span>}
          {onClear && active && (
            <Btn size="sm" variant="ghost" icon={<X className="h-4 w-4" />} onClick={onClear}>
              Clear
            </Btn>
          )}
          {right}
        </div>
      </div>
      {chips.length > 0 && (
        <div className={`${fold} flex flex-wrap gap-2`}>
          {chips.map(c => (
            <button
              key={c.id}
              type="button"
              aria-pressed={c.active}
              onClick={c.onClick}
              className={`inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition ${
                c.active
                  ? c.tone === 'attention'
                    ? 'border-rose-600 bg-danger text-onaccent'
                    : 'border-blue-600 bg-brand text-onaccent'
                  : c.tone === 'attention' && c.count
                    ? 'border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-400'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
              }`}
            >
              {c.label}
              {c.count !== undefined && <span className={`rounded-full px-1.5 text-[12px] ${c.active ? 'bg-onaccent/25' : 'bg-slate-100 text-slate-700'}`}>{c.count}</span>}
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
};

// ---------------------------------------------------------------- state

/** useState that remembers its value on this device (per screen and user). */
export function useSticky<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`apexdrive_ui_${key}`);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`apexdrive_ui_${key}`, JSON.stringify(v));
    } catch {
      /* private mode */
    }
  }, [key, v]);
  return [v, setV];
}
