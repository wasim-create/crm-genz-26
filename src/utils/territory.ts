import { TimeZone } from '../types/crm';

// Standard Haversine distance in miles
export function calculateDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export const TERRITORY_DEFAULT_RADIUS_MILES = 60;

export function isWithinTerritory(distanceMiles: number, radiusLimit = TERRITORY_DEFAULT_RADIUS_MILES): boolean {
  return distanceMiles <= radiusLimit;
}

export function isGoodVisitWindow(timeString24: string): boolean {
  // Golden window is 10:00 AM to 4:00 PM (16:00) inclusive
  const [hoursStr, minutesStr] = timeString24.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr || '0', 10);
  const totalMinutes = hours * 60 + minutes;
  return totalMinutes >= 10 * 60 && totalMinutes <= 16 * 60;
}

export function formatTime12h(timeString24: string): string {
  const [hoursStr, minutesStr = '00'] = timeString24.split(':');
  let hours = parseInt(hoursStr, 10);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutesStr} ${ampm}`;
}

// Strictly used ONLY for authorized incentive payouts (Section 4 exception)
export function formatIncentiveUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

// Deprecated alias for backwards-compatibility only in permitted incentive views
export const formatUSD = formatIncentiveUSD;

export function formatUSDate(dateString?: string): string {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
}

export function formatUSPhone(phone: string): string {
  const cleaned = ('' + phone).replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
}

export function getTimeZoneFromZip(zip: string): TimeZone {
  const prefix = parseInt(zip.substring(0, 3), 10);
  if (isNaN(prefix)) return 'America/New_York';
  if (prefix >= 0 && prefix <= 299) return 'America/New_York';
  if (prefix >= 300 && prefix <= 399) return 'America/New_York';
  if (prefix >= 400 && prefix <= 499) return 'America/New_York';
  if (prefix >= 500 && prefix <= 599) return 'America/Chicago';
  if (prefix >= 600 && prefix <= 799) return 'America/Chicago';
  if (prefix >= 800 && prefix <= 849) return 'America/Denver';
  if (prefix >= 850 && prefix <= 899) return 'America/Denver';
  if (prefix >= 900 && prefix <= 999) return 'America/Los_Angeles';
  return 'America/New_York';
}

export function calculateClientHealthScore(params: {
  daysSinceLastTouch: number;
  hasRecentTopup: boolean;
  activeUpsellCount: number;
  reportedIssues: number;
}): number {
  let score = 100;
  if (params.daysSinceLastTouch > 45) {
    score -= 35;
  } else if (params.daysSinceLastTouch > 30) {
    score -= 20;
  } else if (params.daysSinceLastTouch > 14) {
    score -= 8;
  }

  if (!params.hasRecentTopup) {
    score -= 15;
  } else {
    score += 5;
  }

  score += Math.min(params.activeUpsellCount * 5, 15);
  score -= params.reportedIssues * 20;

  return Math.max(0, Math.min(100, score));
}

// Configurable introduction incentive suggestion (Section 4)
export function calculateSuggestedIncentive(params: {
  usedCarsOnLot: number;
  dealershipType: 'Standalone' | 'Dealer Group';
  rooftopCount: number;
  productCountSigned: number;
}): { amount: number; rule: string } {
  let suggested = 300;
  const components: string[] = ['Standard Introduction'];

  if (params.dealershipType === 'Dealer Group' && params.rooftopCount > 1) {
    const groupBonus = Math.min((params.rooftopCount - 1) * 50, 200);
    suggested += groupBonus;
    components.push(`Group Expansion (${params.rooftopCount} stores)`);
  }

  if (params.usedCarsOnLot >= 150) {
    suggested += 100;
    components.push('High Lot Volume (150+ cars)');
  } else if (params.usedCarsOnLot >= 80) {
    suggested += 50;
    components.push('Mid Lot Volume (80+ cars)');
  }

  if (params.productCountSigned >= 2) {
    suggested += 75;
    components.push(`Multi-Product Client (${params.productCountSigned} products)`);
  }

  return {
    amount: suggested,
    rule: components.join(' • ')
  };
}
