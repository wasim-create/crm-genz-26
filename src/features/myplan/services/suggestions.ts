// "Suggested for you": who is worth contacting and why, in one plain sentence.
// Rules-based so it works with AI switched off; an AI ranker can be layered
// on top later without changing the UI.

import { Dealership, ManagerPriority, ProductBonus, ProductCatalogItem, User } from '../../../types/crm';
import { PlanSlot } from '../types';
import { workTypeForStage } from '../engine/tasks';
import { parseISODate } from '../engine/time';

export interface Suggestion {
  dealershipId: string;
  reason: string;
  score: number;
  priorityFrom?: string;
}

const daysBetween = (fromISO: string | null | undefined, today: string): number | null => {
  if (!fromISO) return null;
  const from = new Date(fromISO.length <= 10 ? `${fromISO}T12:00:00` : fromISO);
  return Math.floor((parseISODate(today).getTime() - from.getTime()) / 86400000);
};

export const hasKeyfetch = (d: Dealership, catalog: ProductCatalogItem[]): boolean => {
  const inventoryIds = catalog.filter(p => p.requiresInventoryTopups).map(p => p.id);
  return (d.signedProducts ?? []).some(p => inventoryIds.includes(p));
};

export function buildSuggestions(params: {
  user: User;
  dealerships: Dealership[];
  priorities: ManagerPriority[];
  bonuses: ProductBonus[];
  catalog: ProductCatalogItem[];
  slots: PlanSlot[];
  today: string;
}): Map<string, Suggestion> {
  const { user, dealerships, priorities, bonuses, catalog, today } = params;
  const out = new Map<string, Suggestion>();
  const put = (s: Suggestion) => {
    const existing = out.get(s.dealershipId);
    if (!existing || existing.score < s.score) out.set(s.dealershipId, s);
  };

  const mine = dealerships.filter(d => d.assignedRepId === user.id);
  const activeBonuses = bonuses.filter(b => b.isActive && b.startDate <= today && b.endDate >= today && b.actionTypes.includes('upsell_won'));

  for (const d of mine) {
    const work = workTypeForStage(d.stage);
    if (!work) continue;
    const since = daysBetween(d.lastTouchpointDate, today);

    if (d.nurtureFollowUpDate && d.nurtureFollowUpDate <= today) {
      put({ dealershipId: d.id, reason: 'Follow-up is due', score: 90 });
    }
    if (work === 'prospect' && d.heatLevel === 'Hot') {
      put({ dealershipId: d.id, reason: 'Hot prospect — keep it moving', score: 80 });
    }
    if (work === 'signup') {
      put({
        dealershipId: d.id,
        reason: d.stage === 'Contract' || d.stage === 'Won' ? 'Ready to sign' : 'Onboarding in progress',
        score: 75
      });
    }
    if (work === 'client' && hasKeyfetch(d, catalog)) {
      const last = [...(d.topups ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];
      const days = daysBetween(last?.date, today);
      if (days === null || days >= 30) {
        put({
          dealershipId: d.id,
          reason: days === null ? 'Keyfetch check — no top-up on record' : `Keyfetch check due — last top-up ${days} days ago`,
          score: 70
        });
      }
    }
    if (work === 'client') {
      const missing = activeBonuses.find(b => !(d.signedProducts ?? []).includes(b.productId));
      if (missing) {
        put({
          dealershipId: d.id,
          reason: `${missing.productName} upsell bonus: ${missing.multiplier ? `${missing.multiplier}× points` : `+${missing.bonusPoints} pts`}`,
          score: 45
        });
      }
    }
    if (since !== null && since >= 14) {
      put({ dealershipId: d.id, reason: `Not contacted in ${since} days`, score: 50 + Math.min(20, since - 14) });
    }
  }

  for (const p of priorities) {
    const forMe = (p.targetType === 'rep' && p.targetId === user.id) || (p.targetType === 'region' && p.targetId === user.region);
    if (!forMe || !p.linkedDealershipId || p.status === 'completed' || p.status === 'declined') continue;
    put({
      dealershipId: p.linkedDealershipId,
      reason: `From ${p.managerName}: ${p.title}`,
      score: p.priorityLevel === 'Urgent' ? 100 : 95,
      priorityFrom: p.managerName
    });
  }

  return out;
}
