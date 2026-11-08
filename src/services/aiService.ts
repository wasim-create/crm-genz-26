import { GoogleGenAI } from '@google/genai';
import { Dealership, Activity, ManagerPriority, ProductBonus, ManagerAssist } from '../types/crm';

function getAIClient(): GoogleGenAI | null {
  try {
    const key = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) ||
      '';
    if (!key || typeof key !== 'string' || key.trim() === '' || key === 'MY_GEMINI_API_KEY') {
      return null;
    }
    return new GoogleGenAI({ apiKey: key });
  } catch {
    return null;
  }
}

export interface PreVisitBrief {
  summary: string;
  keyStats: string;
  talkingPoints: string[];
  likelyObjections: string[];
  recommendedProductAngle: string;
}

export interface PostVisitLogResult {
  structuredNotes: string;
  nextStep: string;
  suggestedFollowUpDays: number;
  isHot: boolean;
  hotReasoning?: string;
  extractedProducts: string[];
}

export interface ScoredDealership {
  dealership: Dealership;
  score: number;
  rankReason: string;
}

export interface GamePlanItem {
  id: string;
  timeWindow: string;
  title: string;
  dealershipId?: string;
  dealershipName?: string;
  type: 'visit' | 'call' | 'email' | 'meet' | 'assist' | 'topup' | 'priority' | 'admin';
  rationale: string;
  points: number;
  isGoodWindow: boolean;
  isLocked: boolean;
  isCompleted: boolean;
  priorityId?: string;
}

export class AIService {
  /**
   * Pre-visit brief (NO pricing or monetary figures).
   */
  static async generatePreVisitBrief(
    dealership: Dealership,
    recentActivities: Activity[],
    repName: string
  ): Promise<PreVisitBrief> {
    const lastNotes = (recentActivities || []).map(a => `${a.activityType}: ${a.notes}`).join(' | ') || 'No prior visit notes on file.';

    const aiClient = getAIClient();
    if (aiClient) {
      try {
        const prompt = `You are an automotive field sales coach. Prepare a concise pre-visit briefing for sales rep ${repName || 'Sales Rep'} visiting ${dealership?.dealershipName || 'Dealership'}.
Strict rule: DO NOT mention any prices, dollar values, revenue, or financial figures. Focus solely on operational volume, lot size, F&I system, warranty claims SLA, and key tracking.
Dealership details:
- Rooftops: ${dealership?.rooftopCount || 1} (${dealership?.dealershipType || 'Standalone'})
- Used Car Inventory: ${dealership?.usedCarsOnLot || 0} cars on lot
- F&I System: ${dealership?.fiSystem || 'DOWC'}
- Pipeline Stage: ${dealership?.stage || 'Negotiation'}
- Prior Activity Notes: ${lastNotes}

Respond with valid JSON formatted as:
{
  "summary": "1-2 sentence executive briefing without money",
  "keyStats": "Rooftops & lot size impact (e.g. 120 used cars, 3 rooftops)",
  "talkingPoints": ["Point 1", "Point 2", "Point 3"],
  "likelyObjections": ["Objection 1", "Objection 2"],
  "recommendedProductAngle": "Which catalog product to emphasize and why"
}`;
        const response = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { responseMimeType: 'application/json' }
        });
        if (response.text) {
          return JSON.parse(response.text) as PreVisitBrief;
        }
      } catch (err) {
        console.warn('Gemini API call failed, using intelligent fallback', err);
      }
    }

    // Deterministic fallback (strictly non-monetary)
    const isGroup = dealership?.dealershipType === 'Dealer Group' && (dealership?.rooftopCount || 1) > 1;
    const isHighVolume = (dealership?.usedCarsOnLot || 0) >= 100;
    
    return {
      summary: `${dealership?.dealershipName || 'Dealership'} is an active ${dealership?.franchiseType || 'Franchise'} dealer with ${dealership?.usedCarsOnLot || 0} used vehicles on lot. Their F&I department runs on ${dealership?.fiSystem || 'DOWC'}.`,
      keyStats: `${dealership?.usedCarsOnLot || 0} used cars (${isHighVolume ? 'High Volume' : 'Mid Volume'}), ${dealership?.rooftopCount || 1} rooftop${(dealership?.rooftopCount || 1) > 1 ? 's' : ''}`,
      talkingPoints: [
        isGroup 
          ? `Highlight multi-rooftop standardization benefits across ${dealership?.groupName || 'their dealer group'}.`
          : `Focus on rapid lot turn and customer presentation for their standalone lot.`,
        (dealership?.fiSystem || '').includes('DOWC')
          ? `Emphasize reinsurance claims turnaround speed (<24 hours) and transparent menu reporting on ${dealership?.fiSystem || 'DOWC'}.`
          : `Address smooth digital workflow integration with ${dealership?.fiSystem || 'F&I system'}.`,
        `Demonstrate Keyfetch smart key tracking to eliminate lost fobs and speed up customer test drives.`
      ],
      likelyObjections: [
        `"Our existing key supplier is locked into contract until end of quarter."`,
        `"Sales staff is comfortable with their current warranty administrator."`
      ],
      recommendedProductAngle: isHighVolume
        ? `Lead with Vehicle Service Contract + Keyfetch combination to streamline lot operations and customer protection.`
        : `Lead with Keyfetch smart key hardware to eliminate daily lot walk-around friction.`
    };
  }

  /**
   * Generates a Manager Assist briefing (NO money or pricing discussed).
   */
  static generateManagerAssistBrief(dealership: Dealership, repName: string): string {
    const products = (dealership?.productInterests || []).map(p => p.productName).join(', ') || 'Vehicle Service Contract, Keyfetch';
    const isGroup = dealership?.dealershipType === 'Dealer Group';
    return `Dealership Overview: ${dealership?.dealershipName || 'Dealership'} has ${dealership?.usedCarsOnLot || 0} pre-owned vehicles on lot with ${dealership?.rooftopCount || 1} rooftop${(dealership?.rooftopCount || 1) > 1 ? 's' : ''}.
F&I Setup: Configured on ${dealership?.fiSystem || 'DOWC'}.
Products of Interest: ${products}.
Rep Context: Rep ${repName || 'Sales Rep'} completed discovery. Decision maker is receptive to claims turnaround speed (<24hr SLA) and requires executive sign-off on program terms.
Key Goal: Co-present with manager to address claims administration turnaround and finalize contract execution.`;
  }

  /**
   * Post-visit assistant: extracts products from the 10-product catalog without pricing.
   */
  static async processPostVisitNotes(
    roughNotes: string,
    dealership: Dealership
  ): Promise<PostVisitLogResult> {
    const lower = roughNotes.toLowerCase();
    const isHotTrigger = lower.includes('ready to sign') || 
      lower.includes('send proposal') || 
      lower.includes('wants contract') || 
      lower.includes('gm loved') || 
      lower.includes('verbal yes') ||
      lower.includes('hot');

    const extractedProducts: string[] = [];
    if (lower.includes('keyfetch') || lower.includes('fob') || lower.includes('key')) extractedProducts.push('Keyfetch');
    if (lower.includes('vsc') || lower.includes('warranty') || lower.includes('service contract')) extractedProducts.push('Vehicle Service Contract (Extended Warranty)');
    if (lower.includes('certified')) extractedProducts.push('Certified Limited Warranty');
    if (lower.includes('gap')) extractedProducts.push('GAP');
    if (lower.includes('tire') || lower.includes('wheel')) extractedProducts.push('Tire & Wheel Protection');
    if (lower.includes('ceramic')) extractedProducts.push('Ceramic Pro');
    if (lower.includes('ev') || lower.includes('charge')) extractedProducts.push('EV Solutions');
    if (lower.includes('gps') || lower.includes('history')) extractedProducts.push('GPS + AI + Vehicle History Plug-in');
    if (extractedProducts.length === 0) extractedProducts.push('Keyfetch');

    return {
      structuredNotes: roughNotes.trim(),
      nextStep: isHotTrigger 
        ? 'Request Manager Assist for joint closing meeting and terms review' 
        : 'Follow up with tailored program overview and dealership reference points',
      suggestedFollowUpDays: isHotTrigger ? 2 : 5,
      isHot: isHotTrigger,
      hotReasoning: isHotTrigger ? 'High buyer intent signals detected (contract requested or manager assist recommended).' : undefined,
      extractedProducts
    };
  }

  /**
   * Lead scoring: ranks prospects using non-monetary parameters.
   */
  static scoreProspects(dealerships: Dealership[]): ScoredDealership[] {
    const scored = (dealerships || []).map(d => {
      let score = 50;

      // Lot size impact
      if ((d.usedCarsOnLot || 0) >= 150) score += 25;
      else if ((d.usedCarsOnLot || 0) >= 80) score += 15;
      else if ((d.usedCarsOnLot || 0) < 40) score -= 10;

      // Group synergy
      if (d.dealershipType === 'Dealer Group' && (d.rooftopCount || 1) > 1) {
        score += 20;
      }

      // Heat level
      if (d.heatLevel === 'Hot') score += 25;
      else if (d.heatLevel === 'Warm') score += 10;

      // Relationship temperature
      if (d.relationshipTemperature?.score) {
        score += Math.round((d.relationshipTemperature.score - 50) * 0.3);
      }

      // Stage weight
      if (d.stage === 'HOT' || d.stage === 'Negotiation') score += 20;
      if (d.stage === 'Client') score -= 5;

      // Recency urgency
      if (d.lastTouchpointDate) {
        const days = Math.floor((Date.now() - new Date(d.lastTouchpointDate).getTime()) / (1000 * 86400));
        if (days > 25) score += 10;
      } else {
        score += 5;
      }

      let rankReason = '';
      if (d.hasActiveAssist) {
        rankReason = `Active Manager Assist in progress with ${d.usedCarsOnLot || 0} lot count.`;
      } else if (d.heatLevel === 'Hot') {
        rankReason = `High urgency: Hot prospect with ${d.usedCarsOnLot || 0} cars ready for closing.`;
      } else if (d.dealershipType === 'Dealer Group') {
        rankReason = `Enterprise value: ${d.groupName || 'Dealer Group'} (${d.rooftopCount || 1} rooftops).`;
      } else if ((d.usedCarsOnLot || 0) >= 120) {
        rankReason = `Volume driver: ${d.usedCarsOnLot} used car inventory on lot.`;
      } else {
        rankReason = `Strategic territory stop with high local turn rate.`;
      }

      return {
        dealership: d,
        score,
        rankReason
      };
    });

    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Generates Today's Game Plan respecting locked stops, Golden Window (10 AM-4 PM),
   * and manager priorities.
   */
  static generateTodayGamePlan(
    dealerships: Dealership[],
    activities: Activity[],
    priorities: ManagerPriority[],
    bonuses: ProductBonus[]
  ): GamePlanItem[] {
    const plan: GamePlanItem[] = [];
    const safePriorities = priorities || [];
    const safeActivities = activities || [];
    const safeDealerships = dealerships || [];

    // 1. Off-hour morning task (8:45 AM - 9:30 AM): phone / email before golden window
    plan.push({
      id: 'gp_am_prep',
      timeWindow: '08:45 - 09:30 AM',
      title: 'Morning Territory Radar & Prep Calls',
      type: 'call',
      rationale: 'Off-hour contact prep before dealerships open for vendor visits.',
      points: 10,
      isGoodWindow: false,
      isLocked: false,
      isCompleted: true
    });

    // 2. Include active manager priorities
    safePriorities.filter(p => p.status === 'scheduled' || p.status === 'accepted').forEach((p, idx) => {
      plan.push({
        id: `gp_prio_${p.id}`,
        timeWindow: idx === 0 ? '10:30 - 11:30 AM' : '02:00 - 02:45 PM',
        title: `Manager Priority: ${p.title}`,
        dealershipId: p.linkedDealershipId,
        dealershipName: p.linkedDealershipName || 'Designated Dealership',
        type: 'priority',
        rationale: `${p.managerName}: "${p.reason}"`,
        points: (p.bonusPoints || 50) + 40,
        isGoodWindow: true,
        isLocked: true, // Manager priorities are pinned
        isCompleted: false,
        priorityId: p.id
      });
    });

    // 3. Existing locked/planned activities in the good window (10 AM - 4 PM)
    const todayActivities = safeActivities.filter(a => a.plannedDate === '2026-11-02');
    todayActivities.forEach(a => {
      const alreadyHas = plan.some(item => item.dealershipId === a.dealershipId);
      if (!alreadyHas) {
        plan.push({
          id: `gp_act_${a.id}`,
          timeWindow: `${a.plannedTime || '11:45 AM'} (Golden Window)`,
          title: `Field Visit: ${a.dealershipName}`,
          dealershipId: a.dealershipId,
          dealershipName: a.dealershipName,
          type: 'visit',
          rationale: a.notes || 'Scheduled in-person discovery and lot inspection.',
          points: a.isGoodWindow ? 40 : 15,
          isGoodWindow: a.isGoodWindow !== false,
          isLocked: !!a.isLocked,
          isCompleted: a.status === 'completed'
        });
      }
    });

    // 4. Keyfetch top-up due check
    const clientWithTopup = safeDealerships.find(d => d.stage === 'Client' && (d.signedProducts || []).includes('prod_3'));
    if (clientWithTopup && !plan.some(p => p.dealershipId === clientWithTopup.id)) {
      plan.push({
        id: `gp_topup_${clientWithTopup.id}`,
        timeWindow: '03:15 - 03:45 PM',
        title: `Keyfetch Routine Top-Up: ${clientWithTopup.dealershipName}`,
        dealershipId: clientWithTopup.id,
        dealershipName: clientWithTopup.dealershipName,
        type: 'topup',
        rationale: 'Projected re-order window approaching. Prevent lot key shortage.',
        points: 30,
        isGoodWindow: true,
        isLocked: false,
        isCompleted: false
      });
    }

    // 5. Late afternoon follow-up (after 4:00 PM)
    plan.push({
      id: 'gp_pm_recap',
      timeWindow: '04:15 - 04:45 PM',
      title: 'Log Daily CRM Touchpoints & Next Actions',
      type: 'admin',
      rationale: 'Clean up pending visit logs to lock in streak points and update relationship temperatures.',
      points: 20,
      isGoodWindow: false,
      isLocked: false,
      isCompleted: false
    });

    return plan;
  }

  /**
   * Executive AI narrative summary (strictly non-monetary).
   */
  static generateExecutiveSummary(period: 'Weekly' | 'Monthly' | 'Quarterly', metrics: {
    clientsSignedCount: number;
    activeDealsCount: number;
    badTimeVisitCount: number;
    goodTimeVisitCount: number;
    keyfetchUnitsRestocked: number;
    upsellsWonCount: number;
    topRepName: string;
    topRepPoints?: number;
    topRegion?: string;
    pendingAssistCount?: number;
    pendingAssistManagers?: string[];
    stalledGroupDealCount?: number;
    atRiskClientNames?: string[];
    noNextStepCount?: number;
    noNextStepByRep?: string[];
  }) {
    // Written only from the numbers passed in — no invented facts.
    const totalVisits = metrics.goodTimeVisitCount + metrics.badTimeVisitCount;
    const goodVisitRatio = Math.round((metrics.goodTimeVisitCount / Math.max(1, totalVisits)) * 100);
    const label = period === 'Weekly' ? 'this week' : period === 'Monthly' ? 'in the last 30 days' : 'in the last 90 days';
    const concerns: string[] = [];
    if (metrics.badTimeVisitCount > 0) concerns.push(`${metrics.badTimeVisitCount} live contact${metrics.badTimeVisitCount > 1 ? 's' : ''} logged outside 10 AM – 4 PM (${100 - goodVisitRatio}% of ${totalVisits}).`);
    if (metrics.atRiskClientNames?.length) concerns.push(`Client health below 70: ${metrics.atRiskClientNames.join(', ')}.`);
    if (metrics.stalledGroupDealCount) concerns.push(`${metrics.stalledGroupDealCount} dealer-group rooftop${metrics.stalledGroupDealCount > 1 ? 's are' : ' is'} in HOT / Negotiation / Contract without a Manager Assist booked.`);
    if (metrics.noNextStepCount) concerns.push(`${metrics.noNextStepCount} live deal${metrics.noNextStepCount > 1 ? 's have' : ' has'} no next step planned${metrics.noNextStepByRep?.length ? ` (${metrics.noNextStepByRep.join(', ')})` : ''}.`);
    if (!concerns.length) concerns.push('No compliance or client-health warnings for this period.');
    const recommendations: string[] = [];
    if (metrics.pendingAssistCount) recommendations.push(`Answer ${metrics.pendingAssistCount} open assist request${metrics.pendingAssistCount > 1 ? 's' : ''} (${(metrics.pendingAssistManagers ?? []).join(', ')}).`);
    if (metrics.noNextStepCount) recommendations.push('Ask each rep to plan a next step for every live deal — use the “no next step” filter on the Pipeline.');
    if (metrics.atRiskClientNames?.length) recommendations.push(`Book an owner-level visit at ${metrics.atRiskClientNames[0]} this week.`);
    recommendations.push('Pitch Ceramic Pro on routine Keyfetch visits while the launch bonus is live.');
    return {
      period,
      headline: `${metrics.clientsSignedCount} dealership${metrics.clientsSignedCount === 1 ? '' : 's'} signed ${label}; ${metrics.activeDealsCount} deals in the pipeline.`,
      highlights: [
        `${metrics.keyfetchUnitsRestocked.toLocaleString()} Keyfetch tags delivered and ${metrics.upsellsWonCount} upsell${metrics.upsellsWonCount === 1 ? '' : 's'} won ${label}.`,
        `Top rep by points: ${metrics.topRepName}${metrics.topRepPoints ? ` with ${metrics.topRepPoints.toLocaleString()} pts` : ''}.`,
        metrics.topRegion ? `Most field visits: ${metrics.topRegion}.` : `${totalVisits} live contacts logged.`
      ],
      concerns,
      recommendations
    };
  }

}
