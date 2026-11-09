// One place for how each pipeline stage is named and coloured on screen.

import { PipelineStage } from '../types/crm';
import type { Tone } from '../components/ui/kit';

export const STAGE_META: Record<PipelineStage, { label: string; tone: Tone; column: string }> = {
  Pool: { label: 'Pool', tone: 'neutral', column: 'bg-slate-50' },
  Claimed: { label: 'Claimed', tone: 'neutral', column: 'bg-slate-50' },
  'Visit Planned': { label: 'Visit planned', tone: 'blue', column: 'bg-blue-50/40' },
  Visited: { label: 'Visited', tone: 'blue', column: 'bg-blue-50/40' },
  'Follow-up': { label: 'Follow-up', tone: 'blue', column: 'bg-sky-50/50' },
  'In Progress': { label: 'In progress', tone: 'blue', column: 'bg-sky-50/50' },
  HOT: { label: 'Hot', tone: 'red', column: 'bg-rose-50/50' },
  Negotiation: { label: 'Negotiation', tone: 'violet', column: 'bg-violet-50/50' },
  Contract: { label: 'Contract', tone: 'violet', column: 'bg-violet-50/50' },
  Won: { label: 'Won', tone: 'green', column: 'bg-emerald-50/50' },
  Signed: { label: 'Signed', tone: 'green', column: 'bg-emerald-50/50' },
  Onboarding: { label: 'Onboarding', tone: 'teal', column: 'bg-teal-50/50' },
  Client: { label: 'Client', tone: 'green', column: 'bg-emerald-50/50' },
  'Not Now': { label: 'Not now', tone: 'amber', column: 'bg-amber-50/50' },
  Lost: { label: 'Lost', tone: 'neutral', column: 'bg-slate-50' },
  Disqualified: { label: 'Disqualified', tone: 'neutral', column: 'bg-slate-50' }
} as Record<PipelineStage, { label: string; tone: Tone; column: string }>;

/** Stages shown on the Pipeline, in order. */
export const PIPELINE_STAGES: PipelineStage[] = ['Claimed', 'Visit Planned', 'Visited', 'Follow-up', 'In Progress', 'HOT', 'Negotiation', 'Contract', 'Won', 'Signed', 'Onboarding', 'Not Now'];

export const stageLabel = (s: PipelineStage | string) => STAGE_META[s as PipelineStage]?.label ?? s;
export const stageTone = (s: PipelineStage | string): Tone => STAGE_META[s as PipelineStage]?.tone ?? 'neutral';
