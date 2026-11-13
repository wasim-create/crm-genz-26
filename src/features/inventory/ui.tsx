// Small shared pieces for showing stock.

import React from 'react';
import { Badge, Tone } from '../../components/ui/kit';
import { STATUS_LABEL } from './stock';
import type { StockStatus } from './types';

export const STATUS_TONE: Record<StockStatus, Tone> = {
  out: 'red',
  order_now: 'red',
  send: 'amber',
  needs_count: 'amber',
  order_soon: 'amber',
  ok: 'green'
};

export const StockBadge: React.FC<{ status: StockStatus }> = ({ status }) => <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;

export const shortDate = (iso?: string) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—');
export const longDate = (iso?: string) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '—');

export const weeksText = (w: number | null) => (w === null ? 'No recent use' : w >= 52 ? 'Over a year' : `${w < 10 ? w.toFixed(1).replace(/\.0$/, '') : Math.round(w)} weeks`);

/** Contracts per week as small bars (oldest first). */
export const WeeklyBars: React.FC<{ weeks: number[]; label?: string }> = ({ weeks, label = 'Contracts per week, last 12 weeks' }) => {
  const max = Math.max(1, ...weeks);
  return (
    <div>
      <div className="flex h-16 items-end gap-1" role="img" aria-label={`${label}: ${weeks.join(', ')}`}>
        {weeks.map((n, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end" title={`${n} contract${n === 1 ? '' : 's'}`}>
            <div className={`w-full rounded-t-sm ${i >= weeks.length - 3 ? 'bg-blue-600' : 'bg-slate-300'}`} style={{ height: `${Math.max(3, (n / max) * 60)}px` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[12px] text-slate-500">
        <span>12 weeks ago</span>
        <span>This week</span>
      </div>
    </div>
  );
};
