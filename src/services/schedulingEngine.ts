import {
  PlanItem,
  DaySettings,
  DistanceBand,
  ContactMethod,
  SlotSuggestion,
  FeasibilityReport
} from '../types/planner';
import { Dealership } from '../types/crm';

// Haversine straight-line distance in miles
export function calculateHaversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function calculateDistanceMiles(
  lat1OrFrom: number | string,
  lon1OrTo?: number | string,
  lat2?: number,
  lon2?: number
): number {
  if (
    typeof lat1OrFrom === 'number' &&
    typeof lon1OrTo === 'number' &&
    typeof lat2 === 'number' &&
    typeof lon2 === 'number'
  ) {
    return calculateHaversineMiles(lat1OrFrom, lon1OrTo, lat2, lon2);
  }
  return 25.0;
}

// Section 1: Distance Bands (from the rep's home)
// 🟢 HOME REGION 0–60 miles
// 🟡 EDGE 60–69 miles (10–15% tolerance, "Edge of your region")
// 🔴 OUT OF TOWN 70+ miles ("travel prospect" handled as a trip)
export function getDistanceBand(
  miles: number,
  homeThresholdOrSettings: number | DaySettings = 60,
  edgeThreshold: number = 69
): DistanceBand {
  let home = 60;
  let edge = 69;
  if (typeof homeThresholdOrSettings === 'object' && homeThresholdOrSettings !== null) {
    home = homeThresholdOrSettings.homeRadiusThreshold ?? 60;
    edge = homeThresholdOrSettings.edgeRadiusThreshold ?? 69;
  } else if (typeof homeThresholdOrSettings === 'number') {
    home = homeThresholdOrSettings;
    edge = edgeThreshold;
  }
  if (miles <= home) return 'home';
  if (miles <= edge) return 'edge';
  return 'out_of_town';
}

export function getDistanceBandColor(band: DistanceBand): { text: string; bg: string; border: string; label: string } {
  switch (band) {
    case 'home':
      return { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Home Region' };
    case 'edge':
      return { text: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-300', label: 'Edge of Region' };
    case 'out_of_town':
      return { text: 'text-rose-800', bg: 'bg-rose-50', border: 'border-rose-300', label: 'Out of Town (Trip)' };
  }
}

export function getDistanceBandBadge(band: DistanceBand, miles?: number): {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
} {
  const milesStr = miles !== undefined ? ` (${Math.round(miles * 10) / 10} mi)` : '';
  switch (band) {
    case 'home':
      return {
        label: `🟢 Home Region${milesStr}`,
        color: 'text-emerald-700',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200'
      };
    case 'edge':
      return {
        label: `🟡 Edge of Region${milesStr}`,
        color: 'text-amber-800',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-300'
      };
    case 'out_of_town':
      return {
        label: `🔴 Out of Town (Trip)${milesStr}`,
        color: 'text-rose-800',
        bgColor: 'bg-rose-50',
        borderColor: 'border-rose-300'
      };
  }
}

// Time string conversions
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTimeStr(totalMin: number): string {
  const normalized = Math.max(0, Math.floor(totalMin));
  const h = Math.floor(normalized / 60) % 24;
  const m = normalized % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(h)}:${pad(m)}`;
}

export function formatTimeTo12h(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const padMin = m < 10 ? `0${m}` : `${m}`;
  return `${displayHour}:${padMin} ${period}`;
}

// Section 5: Live Contact Window: 10:00 AM – 4:00 PM (local dealership time)
export function isInsideLiveContactWindow(timeStr: string): boolean {
  if (!timeStr) return true;
  const min = timeToMinutes(timeStr);
  return min >= 10 * 60 && min <= 16 * 60;
}

// Section 6: Durations and Travel
export function getDefaultDurationMinutes(method: ContactMethod, purpose: string = '', count: number = 1): number {
  const p = purpose.toLowerCase();
  if (method === 'in_person') {
    if (p.includes('contract signing')) return 45;
    if (p.includes('onboarding')) return 60;
    if (p.includes('top-up') || p.includes('keyfetch')) return 20;
    if (p.includes('first visit') || p.includes('discovery')) return 45;
    return 30; // follow-up or routine client care
  }
  if (method === 'phone') {
    if (count > 1) {
      // Call session formula: count * 12 min + 5 min setup
      return count * 12 + 5;
    }
    return 15;
  }
  if (method === 'meet') return 30;
  if (method === 'email') {
    // Email batch formula: 5 min setup + 3 min per dealership
    return 5 + count * 3;
  }
  if (method === 'text') {
    // Text queue formula: 2 min setup + 1 min per dealership
    return 2 + count * 1;
  }
  return 20;
}

export function calculateCallSessionDuration(count: number): number {
  return count * 12 + 5;
}

export function calculateEmailBatchDuration(count: number): number {
  return 5 + count * 3;
}

export function calculateTextBatchDuration(count: number): number {
  return 2 + count * 1;
}

export function estimateDriveTimeMinutes(distanceMiles: number): number {
  const roadMiles = distanceMiles * 1.3;
  const speed = distanceMiles <= 20 ? 30 : 50;
  const rawMin = (roadMiles / speed) * 60;
  return Math.ceil(rawMin / 5) * 5;
}

// Travel calculation:
// straight-line distance * 1.3 road factor, ~30 mph in metro areas and 50 mph rural,
// rounded up to the next 5 minutes, plus a 10-minute parking / walk-in buffer.
export function estimateTravelTime(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  isMetro: boolean = true
): { miles: number; driveMin: number; totalTravelMin: number } {
  const rawMiles = calculateHaversineMiles(fromLat, fromLng, toLat, toLng);
  if (rawMiles === 0) return { miles: 0, driveMin: 0, totalTravelMin: 0 };

  const roadMiles = Math.round(rawMiles * 1.3 * 10) / 10;
  const speedMph = isMetro ? 30 : 50;
  const rawDriveMin = (roadMiles / speedMph) * 60;
  // Round up to next 5 minutes
  const roundedDriveMin = Math.max(5, Math.ceil(rawDriveMin / 5) * 5);
  const parkingBuffer = 10; // 10 min parking & walk-in

  return {
    miles: roadMiles,
    driveMin: roundedDriveMin,
    totalTravelMin: roundedDriveMin + parkingBuffer
  };
}

// Section 5: The Leave-By Time
// first appointment time − drive time from home − parking buffer (10 min) − safety margin (default 10 min)
export function calculateLeaveByTime(
  firstVisitStartTime: string,
  homeCoordsOrDriveMin: number | { lat: number; lng: number },
  firstDealershipCoordsOrSafety?: number | { lat: number; lng: number },
  isMetro: boolean = true,
  safetyMarginMin: number = 10
): {
  leaveByTime: string;
  leaveByTime12h: string;
  leaveByTimeStr: string;
  driveMin: number;
  driveTimeMin: number;
  safetyMarginMin: number;
  totalBufferMin: number;
} {
  let driveMin = 20;
  let safety = 10;

  if (typeof homeCoordsOrDriveMin === 'number') {
    driveMin = homeCoordsOrDriveMin;
    safety = typeof firstDealershipCoordsOrSafety === 'number' ? firstDealershipCoordsOrSafety : 10;
  } else if (
    homeCoordsOrDriveMin &&
    typeof firstDealershipCoordsOrSafety === 'object' &&
    firstDealershipCoordsOrSafety !== null
  ) {
    const travel = estimateTravelTime(
      homeCoordsOrDriveMin.lat,
      homeCoordsOrDriveMin.lng,
      firstDealershipCoordsOrSafety.lat,
      firstDealershipCoordsOrSafety.lng,
      isMetro
    );
    driveMin = travel.driveMin;
    safety = safetyMarginMin ?? 10;
  }

  const parkingBuffer = 10;
  const totalDeduction = driveMin + parkingBuffer + safety;
  const apptMin = timeToMinutes(firstVisitStartTime);
  const leaveByMin = Math.max(0, apptMin - totalDeduction);
  const timeStr = minutesToTimeStr(leaveByMin);

  return {
    leaveByTime: formatTimeTo12h(timeStr),
    leaveByTime12h: formatTimeTo12h(timeStr),
    leaveByTimeStr: timeStr,
    driveMin,
    driveTimeMin: driveMin,
    safetyMarginMin: safety,
    totalBufferMin: totalDeduction
  };
}

export const isWithinLiveContactWindow = isInsideLiveContactWindow;

// Section 5: Recommended Send Times for Non-Live Channels
export function getRecommendedSendTimes(
  channel: 'email' | 'text',
  dayOfWeek: number // 0=Sun, 1=Mon, ..., 6=Sat
): { recommendedSlot: string; prepSlot: string; explanation: string } {
  if (channel === 'email') {
    // Tue-Thu (days 2, 3, 4) peak morning 10:00-11:30 AM
    if (dayOfWeek >= 2 && dayOfWeek <= 4) {
      return {
        recommendedSlot: '10:15',
        prepSlot: '08:30',
        explanation: 'Tue–Thu 10:15 AM is peak dealer open rate. Prep scheduled at 8:30 AM outside live window.'
      };
    }
    return {
      recommendedSlot: '14:00',
      prepSlot: '08:45',
      explanation: 'Afternoon 2:00 PM follow-up window. Prep scheduled before 9 AM.'
    };
  }

  // Text message
  return {
    recommendedSlot: '11:00',
    prepSlot: '09:00',
    explanation: 'Mid-morning text message slot (11:00 AM). Avoids early morning sales meetings.'
  };
}

// Section 7: Slot Suggestions Engine (deterministic code calculates, AI advises)
export function findBestSlots(
  candidateMethod: ContactMethod,
  candidateDurationMin: number,
  candidateCoords: { lat: number; lng: number } | null,
  candidateDealershipName: string,
  existingItems: PlanItem[],
  daySettings: DaySettings,
  dealershipsMap: Map<string, Dealership>
): SlotSuggestion[] {
  const suggestions: SlotSuggestion[] = [];
  const isLive = ['in_person', 'phone', 'meet'].includes(candidateMethod);

  // Live contact window boundaries (10:00 AM - 4:00 PM)
  const windowStartMin = isLive ? 10 * 60 : 8 * 60 + 30;
  const windowEndMin = isLive ? 16 * 60 : 17 * 60;

  // Filter existing active items
  const sortedItems = [...existingItems]
    .filter(i => i.status !== 'not_scheduled' && Boolean(i.startTime))
    .sort((a, b) => timeToMinutes(a.startTime!) - timeToMinutes(b.startTime!));

  // If no items yet, offer opening of window
  if (sortedItems.length === 0) {
    if (isLive) {
      suggestions.push({
        id: 'slot_open_1000',
        time: '10:00',
        date: '',
        displayText: '10:00 AM – First visit of the day (Golden Window open)',
        isRecommended: true,
        driveMinFromPrevious: 0,
        gapMinutesAvailable: 360,
        confidenceReason: 'Clean start inside the 10:00 AM dealership visit window.'
      });
      suggestions.push({
        id: 'slot_open_1330',
        time: '13:30',
        date: '',
        displayText: '1:30 PM – Afternoon post-lunch slot',
        isRecommended: false,
        driveMinFromPrevious: 0,
        gapMinutesAvailable: 150,
        confidenceReason: 'Prime afternoon lot walk time.'
      });
      suggestions.push({
        id: 'slot_open_1445',
        time: '14:45',
        date: '',
        displayText: '2:45 PM – Late afternoon stop',
        isRecommended: false,
        driveMinFromPrevious: 0,
        gapMinutesAvailable: 75,
        confidenceReason: 'Allows ample return travel before 5 PM.'
      });
    } else {
      // Non-live prep / batch
      suggestions.push({
        id: 'slot_prep_0830',
        time: '08:30',
        date: '',
        displayText: '8:30 AM – Morning prep slot (before live window)',
        isRecommended: true,
        driveMinFromPrevious: 0,
        gapMinutesAvailable: 90,
        confidenceReason: 'Keeps 10 AM–4 PM free for live contacts.'
      });
    }
    return suggestions;
  }

  // Search gaps between existing stops
  let cursorMin = windowStartMin;

  for (let idx = 0; idx < sortedItems.length; idx++) {
    const item = sortedItems[idx];
    const itemStart = timeToMinutes(item.startTime!);
    const itemEnd = itemStart + (item.estimatedDurationMin || 30);
    const prevDealer = dealershipsMap.get(item.dealershipId);

    // Check gap before this item
    let driveFromPrev = 0;
    if (candidateMethod === 'in_person' && candidateCoords) {
      const prevCoords = prevDealer ? prevDealer.coordinates : daySettings.startCoords;
      const travel = estimateTravelTime(prevCoords.lat, prevCoords.lng, candidateCoords.lat, candidateCoords.lng, true);
      driveFromPrev = travel.totalTravelMin;
    }

    const arrivalMin = cursorMin + driveFromPrev;
    const requiredEndMin = arrivalMin + candidateDurationMin;

    if (requiredEndMin <= itemStart && arrivalMin >= windowStartMin && requiredEndMin <= windowEndMin) {
      // Check lunch clash (12:00 - 12:30)
      const clashesWithLunch = daySettings.hasLunchBreak && arrivalMin < 12 * 60 + 30 && requiredEndMin > 12 * 60;
      if (!clashesWithLunch) {
        const timeStr = minutesToTimeStr(arrivalMin);
        const explanation = idx === 0 
          ? `${formatTimeTo12h(timeStr)} – fits before ${item.dealershipName}`
          : `${formatTimeTo12h(timeStr)} – ${driveFromPrev} min drive from previous stop`;

        suggestions.push({
          id: `slot_gap_${idx}`,
          time: timeStr,
          date: '',
          displayText: `✅ ${explanation}`,
          isRecommended: suggestions.length === 0,
          driveMinFromPrevious: driveFromPrev,
          previousStopName: idx > 0 ? sortedItems[idx - 1].dealershipName : undefined,
          gapMinutesAvailable: itemStart - arrivalMin,
          confidenceReason: 'Direct geographic fit between planned appointments.'
        });
      }
    }

    cursorMin = Math.max(cursorMin, itemEnd);
  }

  // Check gap after last item
  const lastItem = sortedItems[sortedItems.length - 1];
  const lastItemEnd = timeToMinutes(lastItem.startTime!) + (lastItem.estimatedDurationMin || 30);
  const lastDealer = dealershipsMap.get(lastItem.dealershipId);

  let driveFromLast = 0;
  if (candidateMethod === 'in_person' && candidateCoords) {
    const lastCoords = lastDealer ? lastDealer.coordinates : daySettings.startCoords;
    const travel = estimateTravelTime(lastCoords.lat, lastCoords.lng, candidateCoords.lat, candidateCoords.lng, true);
    driveFromLast = travel.totalTravelMin;
  }

  let postLastArrival = lastItemEnd + driveFromLast;
  // If lunch break falls between
  if (daySettings.hasLunchBreak && postLastArrival >= 12 * 60 && postLastArrival < 12 * 60 + 30) {
    postLastArrival = 12 * 60 + 30 + driveFromLast;
  }

  if (postLastArrival + candidateDurationMin <= windowEndMin) {
    const timeStr = minutesToTimeStr(postLastArrival);
    suggestions.push({
      id: 'slot_post_last',
      time: timeStr,
      date: '',
      displayText: `${formatTimeTo12h(timeStr)} – right after ${lastItem.dealershipName} (${driveFromLast}m drive)`,
      isRecommended: suggestions.length === 0,
      driveMinFromPrevious: driveFromLast,
      previousStopName: lastItem.dealershipName,
      gapMinutesAvailable: windowEndMin - postLastArrival,
      confidenceReason: 'Seamless follow-on after your last scheduled appointment.'
    });
  }

  // If still need slots, provide standard afternoon backup
  if (suggestions.length < 2 && 14 * 60 + candidateDurationMin <= windowEndMin) {
    suggestions.push({
      id: 'slot_backup_1400',
      time: '14:00',
      date: '',
      displayText: '2:00 PM – afternoon open slot',
      isRecommended: false,
      driveMinFromPrevious: 15,
      gapMinutesAvailable: 120,
      confidenceReason: 'Good availability in afternoon window.'
    });
  }

  return suggestions.slice(0, 3);
}

// Find nearby prospects/clients within 15 miles to group into trips or add-ons
export function findNearbyDealerships(
  centerLat: number,
  centerLng: number,
  allDealerships: Dealership[],
  excludeIds: string[],
  radiusMiles: number = 15
): (Dealership & { proximityMiles: number })[] {
  return allDealerships
    .filter(d => !excludeIds.includes(d.id))
    .map(d => {
      const miles = calculateHaversineMiles(centerLat, centerLng, d.coordinates.lat, d.coordinates.lng);
      return { ...d, proximityMiles: miles };
    })
    .filter(d => d.proximityMiles <= radiusMiles)
    .sort((a, b) => a.proximityMiles - b.proximityMiles);
}

export function groupNearbyDealerships(
  anchor: Dealership,
  allDealerships: Dealership[],
  radiusMiles: number = 15
): Dealership[] {
  return findNearbyDealerships(
    anchor.coordinates?.lat || 32.7767,
    anchor.coordinates?.lng || -96.7970,
    allDealerships,
    [anchor.id],
    radiusMiles
  );
}

export function findFeasibleSlots(
  dealership: Dealership,
  existingDayItems: PlanItem[],
  settings: DaySettings,
  durationMin: number = 45,
  userDaySettings?: DaySettings
): SlotSuggestion[] {
  const method: ContactMethod = 'in_person';
  const coords = dealership.coordinates || { lat: 32.7767, lng: -96.7970 };
  const dMap = new Map<string, Dealership>();
  dMap.set(dealership.id, dealership);

  const best = findBestSlots(
    method,
    durationMin,
    coords,
    dealership.dealershipName,
    existingDayItems,
    settings || userDaySettings,
    dMap
  );

  const todayStr = existingDayItems[0]?.date || new Date().toISOString().split('T')[0];

  return best.map(b => {
    const sTime = b.time || '10:30';
    const eTime = minutesToTimeStr(timeToMinutes(sTime) + durationMin);
    return {
      ...b,
      date: b.date || todayStr,
      startTime: sTime,
      endTime: eTime,
      reason: b.confidenceReason || b.displayText
    };
  });
}

// Section 9: Full Schedule Feasibility Evaluation
export function buildComprehensiveSchedule(
  items: PlanItem[],
  daySettings: DaySettings,
  dealershipsMap: Map<string, Dealership>
): {
  scheduledItems: PlanItem[];
  feasibility: FeasibilityReport;
} {
  const activeItems = [...items].filter(i => i.status !== 'not_scheduled');
  
  let currentClock = timeToMinutes(daySettings.dayStartTime || '08:30');
  let currentLat = daySettings.startCoords.lat;
  let currentLng = daySettings.startCoords.lng;

  let totalDriveMin = 0;
  let totalDistanceMiles = 0;
  let totalContactMin = 0;
  let outsideWindowCount = 0;
  let firstInPersonItem: PlanItem | null = null;
  let homeCount = 0;
  let edgeCount = 0;
  let outOfTownCount = 0;

  const scheduledItems: PlanItem[] = [];

  // Sort items by explicit startTime or preserve order
  const orderedItems = activeItems.sort((a, b) => {
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    if (a.startTime) return -1;
    if (b.startTime) return 1;
    return 0;
  });

  for (let idx = 0; idx < orderedItems.length; idx++) {
    const item = { ...orderedItems[idx] };
    const dealer = dealershipsMap.get(item.dealershipId);

    // Calculate duration
    if (!item.estimatedDurationMin) {
      item.estimatedDurationMin = getDefaultDurationMinutes(item.method, item.purpose, item.dealershipIds?.length || 1);
    }
    totalContactMin += item.estimatedDurationMin;

    // Classify distance band from home
    if (dealer) {
      const milesFromHome = calculateHaversineMiles(
        daySettings.startCoords.lat,
        daySettings.startCoords.lng,
        dealer.coordinates.lat,
        dealer.coordinates.lng
      );
      item.distanceMiles = milesFromHome;
      item.distanceBand = getDistanceBand(milesFromHome, daySettings.homeRadiusThreshold, daySettings.edgeRadiusThreshold);

      if (item.distanceBand === 'home') homeCount++;
      else if (item.distanceBand === 'edge') edgeCount++;
      else outOfTownCount++;
    }

    if (item.method === 'in_person' && dealer) {
      if (!firstInPersonItem) {
        firstInPersonItem = item;
      }

      const travel = estimateTravelTime(currentLat, currentLng, dealer.coordinates.lat, dealer.coordinates.lng, true);
      item.travelBeforeMin = travel.totalTravelMin;
      item.travelDistanceMiles = travel.miles;
      totalDriveMin += travel.driveMin;
      totalDistanceMiles += travel.miles;

      if (!item.startTime) {
        let arrivalMin = currentClock + travel.totalTravelMin;
        if (arrivalMin < 10 * 60) arrivalMin = 10 * 60; // Golden Window anchor
        item.startTime = minutesToTimeStr(arrivalMin);
        currentClock = arrivalMin + item.estimatedDurationMin;
      } else {
        const setMin = timeToMinutes(item.startTime);
        currentClock = Math.max(setMin, currentClock + travel.totalTravelMin) + item.estimatedDurationMin;
      }

      // Check Golden Window
      const startMin = timeToMinutes(item.startTime);
      const endMin = startMin + item.estimatedDurationMin;
      if (startMin < 10 * 60 || endMin > 16 * 60) {
        outsideWindowCount++;
      }

      currentLat = dealer.coordinates.lat;
      currentLng = dealer.coordinates.lng;
    } else {
      // Remote item (phone, text, email, meet, call_session) -> 0 drive time
      item.travelBeforeMin = 0;
      item.travelDistanceMiles = 0;
      if (!item.startTime) {
        item.startTime = minutesToTimeStr(currentClock);
        currentClock += item.estimatedDurationMin + (daySettings.defaultVisitBufferMin || 5);
      } else {
        currentClock = timeToMinutes(item.startTime) + item.estimatedDurationMin;
      }
    }

    // Insert lunch around noon if enabled
    if (daySettings.hasLunchBreak && currentClock >= 12 * 60 && currentClock < 13 * 60) {
      currentClock += (daySettings.lunchDurationMin || 30);
    }

    scheduledItems.push(item);
  }

  // Calculate return travel from last stop back to home endAddress
  let returnDriveMin = 0;
  if (scheduledItems.some(i => i.method === 'in_person')) {
    const returnTravel = estimateTravelTime(currentLat, currentLng, daySettings.endCoords.lat, daySettings.endCoords.lng, true);
    returnDriveMin = returnTravel.driveMin;
    totalDriveMin += returnTravel.driveMin;
    totalDistanceMiles += returnTravel.miles;
    currentClock += returnTravel.totalTravelMin;
  }

  // Compute Leave-By Time if in-person visit exists
  let leaveByTimeFormatted: string | undefined;
  if (firstInPersonItem && firstInPersonItem.startTime) {
    const firstDealer = dealershipsMap.get(firstInPersonItem.dealershipId);
    if (firstDealer) {
      const leaveBy = calculateLeaveByTime(
        firstInPersonItem.startTime,
        daySettings.startCoords,
        firstDealer.coordinates,
        true,
        daySettings.safetyMarginMin || 10
      );
      leaveByTimeFormatted = leaveBy.leaveByTime12h;
      firstInPersonItem.leaveByTime = leaveBy.leaveByTime12h;
    }
  }

  const estimatedFinishTime = minutesToTimeStr(currentClock);
  const preferredFinishMin = timeToMinutes(daySettings.dayFinishTime || '17:30');
  const totalWorkMin = totalContactMin + totalDriveMin;

  // Feasibility score
  let score: FeasibilityReport['score'] = 'good';
  let label = 'Good';
  let color = 'text-blue-700 bg-blue-50 border-blue-200';

  if (totalWorkMin < 3 * 60) {
    score = 'light';
    label = 'Light';
    color = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  } else if (totalWorkMin > 7.5 * 60 || currentClock > preferredFinishMin + 30) {
    score = 'too_much';
    label = 'Too much';
    color = 'text-rose-700 bg-rose-50 border-rose-200';
  } else if (totalWorkMin > 5.5 * 60 || currentClock > preferredFinishMin) {
    score = 'full';
    label = 'Full';
    color = 'text-amber-700 bg-amber-50 border-amber-200';
  }

  // Warnings
  const warnings: FeasibilityReport['warnings'] = [];

  if (totalDriveMin > 210) {
    warnings.push({
      id: 'high_drive',
      severity: 'warning',
      message: `This day has ${Math.round(totalDriveMin / 60)} hours of driving. Consider grouping stops by area.`,
      fixLabel: 'Move to Thursday',
      fixAction: 'move_distant_stop'
    });
  }

  if (edgeCount > 0) {
    warnings.push({
      id: 'edge_stop',
      severity: 'info',
      message: `${edgeCount} stop is at the edge of your region (60–69 mi).`,
      fixLabel: 'Review travel'
    });
  }

  if (outOfTownCount > 0) {
    warnings.push({
      id: 'out_of_town_stop',
      severity: 'warning',
      message: `This day includes an out-of-town stop (70+ mi). Best scheduled as a dedicated Trip day.`,
      fixLabel: 'Make a Trip',
      fixAction: 'create_trip'
    });
  }

  if (outsideWindowCount > 0) {
    const lastStop = scheduledItems.filter(i => i.method === 'in_person').slice(-1)[0];
    if (lastStop && timeToMinutes(lastStop.startTime || '0') + lastStop.estimatedDurationMin > 16 * 60) {
      warnings.push({
        id: 'outside_window_late',
        severity: 'warning',
        message: `Your visit to ${lastStop.dealershipName} ends after 4:00 PM (outside the Golden Window).`,
        fixLabel: 'Turn into a phone call',
        fixAction: 'convert_to_phone',
        targetItemId: lastStop.id
      });
    }
  }

  return {
    scheduledItems,
    feasibility: {
      score,
      label,
      color,
      totalContactMin,
      totalDriveMin,
      totalDistanceMiles: Math.round(totalDistanceMiles * 10) / 10,
      leaveByTime: leaveByTimeFormatted,
      estimatedFinishTime,
      isOverCapacity: score === 'too_much',
      outsideGoodWindowCount: outsideWindowCount,
      bandBreakdown: { homeCount, edgeCount, outOfTownCount },
      warnings
    }
  };
}
