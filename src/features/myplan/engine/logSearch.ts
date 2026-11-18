// "Log a visit or call": telling dealerships apart, and finding ones that
// aren't on the rep's own list (lost, in the pool, a teammate's) instead of
// saying "none match" when they exist.

import type { Contact, DealerGroup, Dealership, User } from '../../../types/crm';
import { workTypeForStage } from './tasks';

export type RelTone = 'blue' | 'violet' | 'green' | 'neutral' | 'amber';

/** What the dealership is to us, in a word or two: Prospect, Signing up, Client, Lost… */
export function relationshipOf(d: Pick<Dealership, 'stage'>): { label: string; tone: RelTone } {
  if (d.stage === 'Lost') return { label: 'Lost', tone: 'neutral' };
  if (d.stage === 'Disqualified') return { label: 'Disqualified', tone: 'neutral' };
  if (d.stage === 'Pool') return { label: 'Prospect pool', tone: 'amber' };
  const w = workTypeForStage(d.stage);
  if (w === 'client') return { label: 'Client', tone: 'green' };
  if (w === 'signup') return { label: 'Signing up', tone: 'violet' };
  return { label: 'Prospect', tone: 'blue' };
}

export type HiddenReason = 'lost' | 'pool' | 'teammate' | 'unassigned';

export interface HiddenMatch {
  dealership: Dealership;
  reason: HiddenReason;
  /** The teammate whose account it is. */
  ownerName?: string;
}

/** Active dealerships that are the rep's own: the ones "Log a visit" lists by default. */
export const isMineActive = (d: Dealership, userId: string) =>
  d.assignedRepId === userId && !d.isPlaceholder && d.stage !== 'Lost' && d.stage !== 'Disqualified';

/**
 * Search every dealership by name, city, street, ZIP, contact name or group name.
 * The rep's own active ones come first; anything else that matches comes back
 * with the reason it isn't on their list, so they can still log it.
 */
export function searchDealerships(
  q: string,
  input: { all: Dealership[]; userId: string; contacts: Contact[]; groups: DealerGroup[]; users: User[] },
  limit = 8
): { mine: Dealership[]; hidden: HiddenMatch[] } {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return { mine: [], hidden: [] };
  const groupName = new Map(input.groups.map(g => [g.id, g.name]));
  const people = new Map<string, string>();
  for (const c of input.contacts) people.set(c.dealershipId, `${people.get(c.dealershipId) ?? ''} ${c.firstName} ${c.lastName}`);
  const hay = (d: Dealership) =>
    [d.dealershipName, d.city, d.address, d.zipCode, d.state, d.groupId ? groupName.get(d.groupId) : '', people.get(d.id)].filter(Boolean).join(' ').toLowerCase();
  const hits = input.all.filter(d => !d.isPlaceholder && words.every(w => hay(d).includes(w)));
  const mine = hits.filter(d => isMineActive(d, input.userId)).slice(0, limit);
  const hidden: HiddenMatch[] = hits
    .filter(d => !isMineActive(d, input.userId))
    .map(d => {
      if (d.assignedRepId === input.userId) return { dealership: d, reason: 'lost' as const };
      if (d.stage === 'Pool') return { dealership: d, reason: 'pool' as const };
      const owner = input.users.find(u => u.id === d.assignedRepId);
      return owner ? { dealership: d, reason: 'teammate' as const, ownerName: `${owner.firstName} ${owner.lastName}` } : { dealership: d, reason: 'unassigned' as const };
    })
    .slice(0, limit);
  return { mine, hidden };
}

/** The street and town, short: "1550 W Ogden Ave, Naperville". */
export const streetLine = (d: Pick<Dealership, 'address' | 'city'>) => [d.address, d.city].filter(Boolean).join(', ');
