// Shared bits for showing flags: the icon for each rule and the status badge.

import React from 'react';
import { Activity, Boxes, CalendarX2, ClipboardCheck, Flag as FlagIcon, HeartCrack, Hourglass, LifeBuoy, Sprout, Target, TrendingDown } from 'lucide-react';
import { Badge, Tone } from '../../components/ui/kit';
import type { Flag, RepStatus } from './signals';
import { STATUS_LABEL } from './signals';

export const STATUS_TONE: Record<RepStatus, Tone> = { help: 'red', watch: 'amber', good: 'green' };

export const StatusBadge: React.FC<{ status: RepStatus }> = ({ status }) => <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;

export function FlagGlyph({ flag, className = 'h-4 w-4' }: { flag: Pick<Flag, 'id' | 'kind'>; className?: string }) {
  const id = flag.id.startsWith('losses_') ? 'losses' : flag.id;
  switch (id) {
    case 'quiet':
      return <Activity className={className} />;
    case 'drop':
      return <TrendingDown className={className} />;
    case 'plan':
      return <CalendarX2 className={className} />;
    case 'no_next':
      return <FlagIcon className={className} />;
    case 'waiting':
    case 'stuck':
      return <Hourglass className={className} />;
    case 'risk':
      return <HeartCrack className={className} />;
    case 'losses':
      return <Target className={className} />;
    case 'new_rep':
      return <Sprout className={className} />;
    case 'assist_waiting':
      return <LifeBuoy className={className} />;
    case 'keyfetch_low':
      return <Boxes className={className} />;
    case 'keyfetch_count':
      return <ClipboardCheck className={className} />;
    case 'contracts_drop':
      return <TrendingDown className={className} />;
    default:
      return <FlagIcon className={className} />;
  }
}

export const KIND_LABEL: Record<Flag['kind'], string> = {
  effort: 'Effort',
  deals: 'Deals',
  skill: 'Skill',
  new: 'New starter',
  support: 'Waiting on you'
};

/** Colour of a flag's icon: red for needs help, amber for keep an eye, grey once handled. */
export const flagColour = (f: Flag) => (f.handled ? 'text-slate-400' : f.level === 'help' ? 'text-rose-600' : 'text-amber-600');

export const initials = (first: string, last: string) => `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
