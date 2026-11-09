// Small, accessible building blocks used across My Plan.
// Big tap targets (≥ 48px), words with every icon, high contrast.

import React from 'react';
import { ArrowLeft, Building2, Car, Coffee, Mail, MessageSquare, Phone, Users, Video, X } from 'lucide-react';
import { DistanceBand, HowType, WorkType } from '../types';
import { HOW_LABEL, WORK_TYPE_LABEL } from '../engine/tasks';

export const WORK_STYLE: Record<WorkType, { chip: string; edge: string; dot: string; soft: string }> = {
  prospect: { chip: 'bg-emerald-50 text-emerald-800 border-emerald-200', edge: 'border-l-emerald-500', dot: 'bg-emerald-500', soft: 'bg-emerald-50' },
  signup: { chip: 'bg-amber-50 text-amber-900 border-amber-200', edge: 'border-l-amber-500', dot: 'bg-amber-500', soft: 'bg-amber-50' },
  client: { chip: 'bg-sky-50 text-sky-800 border-sky-200', edge: 'border-l-sky-500', dot: 'bg-sky-500', soft: 'bg-sky-50' },
  group: { chip: 'bg-violet-50 text-violet-800 border-violet-200', edge: 'border-l-violet-500', dot: 'bg-violet-500', soft: 'bg-violet-50' },
  block: { chip: 'bg-slate-100 text-slate-700 border-slate-200', edge: 'border-l-slate-400', dot: 'bg-slate-400', soft: 'bg-slate-50' }
};

export const HOW_ICON: Record<HowType, React.FC<{ className?: string }>> = {
  in_person: Car,
  phone: Phone,
  meet: Video,
  email: Mail,
  text: MessageSquare
};

export const WorkChip: React.FC<{ workType: WorkType; className?: string }> = ({ workType, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-semibold ${WORK_STYLE[workType].chip} ${className}`}>
    <span className={`h-2 w-2 rounded-full ${WORK_STYLE[workType].dot}`} />
    {WORK_TYPE_LABEL[workType]}
  </span>
);

export const HowLabel: React.FC<{ how: HowType; className?: string }> = ({ how, className = '' }) => {
  const Icon = HOW_ICON[how];
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold text-slate-700 ${className}`}>
      <Icon className="h-[18px] w-[18px] text-slate-500" />
      {HOW_LABEL[how]}
    </span>
  );
};

export const BandChip: React.FC<{ band: DistanceBand; miles: number }> = ({ band, miles }) => {
  const style =
    band === 'home'
      ? 'bg-white text-slate-600 border-slate-200'
      : band === 'edge'
        ? 'bg-amber-50 text-amber-900 border-amber-300'
        : 'bg-rose-50 text-rose-800 border-rose-300';
  const dot = band === 'home' ? '🟢' : band === 'edge' ? '🟡' : '🔴';
  const text = band === 'home' ? `${Math.round(miles)} mi` : band === 'edge' ? `${Math.round(miles)} mi · edge of region` : `${Math.round(miles)} mi · out of town`;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[13px] font-medium ${style}`}>
      <span aria-hidden>{dot}</span>
      {text}
    </span>
  );
};

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'md' | 'lg'; icon?: React.ReactNode; block?: boolean }
> = ({ variant = 'secondary', size = 'md', icon, block, className = '', children, ...rest }) => {
  const v: Record<ButtonVariant, string> = {
    primary: 'bg-brand text-onaccent hover:bg-brand-hover shadow-sm disabled:bg-slate-300',
    secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
    danger: 'bg-white text-rose-700 border border-rose-300 hover:bg-rose-50',
    soft: 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
  };
  const s = size === 'lg' ? 'min-h-[56px] px-6 text-[17px]' : 'min-h-[48px] px-4 text-[16px]';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed ${v[variant]} ${s} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
};

/** Full-screen panel (no pop-ups on pop-ups). */
export const Sheet: React.FC<{
  title: string;
  step?: { current: number; total: number };
  summary?: React.ReactNode;
  onBack?: () => void;
  onClose: () => void;
  footer?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}> = ({ title, step, summary, onBack, onClose, footer, wide, children }) => (
  <div className="fixed inset-0 z-[60] flex flex-col bg-slate-50" role="dialog" aria-modal="true" aria-label={title}>
    <div className="border-b border-slate-200 bg-white">
      <div className={`mx-auto flex items-center gap-2 px-3 py-2 ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>
        {onBack ? (
          <Button variant="ghost" onClick={onBack} icon={<ArrowLeft className="h-5 w-5" />} aria-label="Back">
            Back
          </Button>
        ) : (
          <span className="w-2" />
        )}
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[18px] font-bold text-slate-900">{title}</div>
          {step && (
            <div className="text-[13px] font-medium text-slate-500">
              Step {step.current} of {step.total}
            </div>
          )}
        </div>
        <Button variant="ghost" onClick={onClose} icon={<X className="h-5 w-5" />} aria-label="Close">
          Close
        </Button>
      </div>
      {summary && (
        <div className={`mx-auto px-4 pb-2 text-center text-[14px] text-slate-600 ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>{summary}</div>
      )}
    </div>
    <div className="flex-1 overflow-y-auto">
      <div className={`mx-auto px-4 py-5 ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>{children}</div>
    </div>
    {footer && (
      <div className="border-t border-slate-200 bg-white">
        <div className={`mx-auto px-4 py-3 ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>{footer}</div>
      </div>
    )}
  </div>
);

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...rest }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`} {...rest} />
);

export const SectionTitle: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
  <div className="mb-2 mt-6 flex items-end justify-between gap-2">
    <h2 className="text-[15px] font-bold uppercase tracking-wide text-slate-500">{children}</h2>
    {right}
  </div>
);

export const ChoiceCard: React.FC<{
  selected?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  disabled?: boolean;
}> = ({ selected, onClick, icon, title, subtitle, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    aria-pressed={selected}
    className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${
      selected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
    } ${disabled ? 'opacity-40' : ''}`}
  >
    {icon && <span className="shrink-0 text-slate-600">{icon}</span>}
    <span className="min-w-0 flex-1">
      <span className="block text-[17px] font-semibold text-slate-900">{title}</span>
      {subtitle && <span className="block text-[14px] text-slate-500">{subtitle}</span>}
    </span>
    {selected && <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[12px] font-bold text-onaccent">Chosen</span>}
  </button>
);

export const Checkbox: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }> = ({
  checked,
  onChange,
  label,
  hint,
  disabled
}) => (
  <label
    className={`flex min-h-[56px] cursor-pointer items-start gap-3 rounded-2xl border-2 px-4 py-3 transition ${
      checked ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
    } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
  >
    <input
      type="checkbox"
      className="mt-0.5 h-6 w-6 shrink-0 accent-blue-600"
      checked={checked}
      disabled={disabled}
      onChange={e => onChange(e.target.checked)}
    />
    <span>
      <span className="block text-[17px] font-semibold text-slate-900">{label}</span>
      {hint && <span className="block text-[14px] text-slate-500">{hint}</span>}
    </span>
  </label>
);

export const Segmented = <T extends string>({
  options,
  value,
  onChange,
  ariaLabel
}: {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
  ariaLabel: string;
}) => (
  <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-2">
    {options.map(o => (
      <button
        key={o.value}
        type="button"
        role="radio"
        aria-checked={value === o.value}
        onClick={() => onChange(o.value)}
        className={`min-h-[44px] rounded-xl border-2 px-3.5 text-[15px] font-semibold transition ${
          value === o.value ? 'border-blue-600 bg-brand text-onaccent' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export const TargetIcon: React.FC<{ kind: 'dealership' | 'group' | 'block'; className?: string }> = ({ kind, className = 'h-5 w-5' }) =>
  kind === 'group' ? <Users className={className} /> : kind === 'block' ? <Coffee className={className} /> : <Building2 className={className} />;

export const EmptyState: React.FC<{ icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }> = ({ icon, title, text, action }) => (
  <Card className="flex flex-col items-center px-6 py-10 text-center">
    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">{icon}</div>
    <div className="text-[19px] font-bold text-slate-900">{title}</div>
    {text && <p className="mt-1 max-w-sm text-[16px] text-slate-600">{text}</p>}
    {action && <div className="mt-5">{action}</div>}
  </Card>
);
