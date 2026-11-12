import type { Dealership, PipelineStage } from '../types/crm';

/** Fields to set when a deal changes stage: when it moved, and where it died if lost. */
export function stageTracking(prev: Pick<Dealership, 'stage'>, next: PipelineStage, today: string): Partial<Dealership> {
  return {
    stageSince: today,
    ...(next === 'Lost' ? { lostAtStage: prev.stage, lostDate: today } : {})
  };
}
