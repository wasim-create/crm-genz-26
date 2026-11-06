// Deterministic Scheduling Engine for ApexDrive My Plan
// GOLDEN RULE: CODE CALCULATES, AI ADVISES.

import {
  PlanSlot,
  DistanceBand,
  DaySettings,
  SlotSuggestion,
  DayRecalculationResult,
  ActivityType,
  WorkType
} from '../types/myplan.types';

export const DEFAULT_DAY_SETTINGS: DaySettings = {
  homeRadiusThreshold: 60,
  edgeRadiusThreshold: 69,
  outOfTownThreshold: 70,
  safetyMarginMin: 10,
  parkingBufferMin: 10,
  liveWindowStart: '10:00',
  liveWindowEnd: '16:00',
  requireTripApproval: false,
  biggerText: false
};

// 1. Precise Haversine distance in statute miles
export function calculateHaversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// 2. Distance with flexible coordinate / zip code lookup
export function calculateDistanceMiles(
  from: string | { lat: number; lng: number },
  to: string | { lat: number; lng: number }
): number {
  const getCoords = (val: string | { lat: number; lng: number }): { lat: number; lng: number } => {
    if (typeof val === 'object' && val !== null && 'lat' in val && 'lng' in val) {
      return val;
    }
    // Deterministic US ZIP code coordinate lookup table
    const zipStr = String(val).trim().substring(0, 5);
    const zipCoords: Record<string, { lat: number; lng: number }> = {
      '75001': { lat: 32.961, lng: -96.837 }, // Addison, TX
      '75002': { lat: 33.104, lng: -96.653 }, // Allen, TX
      '75006': { lat: 32.953, lng: -96.890 }, // Carrollton, TX
      '75024': { lat: 33.078, lng: -96.804 }, // Plano, TX
      '75025': { lat: 33.090, lng: -96.750 }, // Plano West, TX
      '75034': { lat: 33.155, lng: -96.835 }, // Frisco, TX
      '75035': { lat: 33.150, lng: -96.790 }, // Frisco East, TX
      '75070': { lat: 33.197, lng: -96.671 }, // McKinney, TX
      '75071': { lat: 33.240, lng: -96.620 }, // McKinney North, TX
      '75075': { lat: 33.045, lng: -96.730 }, // Plano Central, TX
      '75080': { lat: 32.980, lng: -96.730 }, // Richardson, TX
      '75201': { lat: 32.787, lng: -96.799 }, // Downtown Dallas, TX
      '76102': { lat: 32.755, lng: -97.330 }, // Fort Worth, TX
      '75401': { lat: 33.138, lng: -96.110 }, // Greenville, TX (approx 52 mi)
      '75460': { lat: 33.660, lng: -95.555 }, // Paris, TX (approx 95 mi)
      '75701': { lat: 32.351, lng: -95.301 }, // Tyler, TX (approx 98 mi)
      '76701': { lat: 31.549, lng: -97.146 }, // Waco, TX (approx 105 mi)
      '75601': { lat: 32.500, lng: -94.740 }, // Longview, TX (approx 125 mi)
      '75090': { lat: 33.635, lng: -96.608 }, // Sherman, TX (approx 64 mi, Edge)
      '75418': { lat: 33.578, lng: -96.178 }, // Bonham, TX (approx 66 mi, Edge)
    };

    if (zipCoords[zipStr]) return zipCoords[zipStr];
    // Simple deterministic numeric hash fallback for testing other zip codes
    const num = parseInt(zipStr.replace(/\D/g, ''), 10) || 75001;
    return {
      lat: 32.7 + ((num % 100) * 0.02),
      lng: -96.8 - (((num / 100) % 100) * 0.02)
    };
  };

  const c1 = getCoords(from);
  const c2 = getCoords(to);
  return calculateHaversineMiles(c1.lat, c1.lng, c2.lat, c2.lng);
}

// 3. Distance Band classifier:
// 🟢 Home Region (0–60 miles)
// 🟡 Edge (60–69 miles)
// 🔴 Out of Town (70+ miles)
export function getDistanceBand(
  distanceMiles: number,
  settings: Partial<DaySettings> = {}
): DistanceBand {
  const homeMax = settings.homeRadiusThreshold ?? DEFAULT_DAY_SETTINGS.homeRadiusThreshold;
  const edgeMax = settings.edgeRadiusThreshold ?? DEFAULT_DAY_SETTINGS.edgeRadiusThreshold;
  if (distanceMiles <= homeMax) return 'home';
  if (distanceMiles <= edgeMax) return 'edge';
  return 'out_of_town';
}

export function getDistanceBandInfo(band: DistanceBand, miles: number) {
  switch (band) {
    case 'home':
      return {
        badge: '🟢 Home Region',
        shortLabel: `${miles} mi`,
        color: 'text-emerald-300',
        bg: 'bg-emerald-950/70 border-emerald-500/40',
        note: ''
      };
    case 'edge':
      return {
        badge: '🟡 Edge of Region',
        shortLabel: `${miles} mi (Edge)`,
        color: 'text-amber-300',
        bg: 'bg-amber-950/70 border-amber-500/40',
        note: 'Edge of your region. Extra drive time recommended.'
      };
    case 'out_of_town':
      return {
        badge: '🔴 Out of Town',
        shortLabel: `${miles} mi (Trip)`,
        color: 'text-rose-300',
        bg: 'bg-rose-950/70 border-rose-500/40',
        note: 'Out-of-town distance. Dedicated trip planning suggested.'
      };
  }
}

// 4. Drive time estimate (straight-line * 1.3 road factor, rounded up to 5 min)
export function estimateDriveTimeMinutes(miles: number, isMetro = true): number {
  if (miles <= 0) return 0;
  const roadFactor = 1.3;
  const effectiveSpeedMph = isMetro ? 30 : 50;
  const actualRoadMiles = miles * roadFactor;
  const minutesRaw = (actualRoadMiles / effectiveSpeedMph) * 60;
  // Round up to nearest 5 minutes, minimum 10 min
  const rounded = Math.ceil(minutesRaw / 5) * 5;
  return Math.max(10, rounded);
}

// 5. Leave-By Time calculation:
// Formula: First Visit Start - Drive Time - 10 min parking - 10 min safety margin
export function calculateLeaveByTime(
  firstVisitStartTime: string,
  driveTimeMin: number,
  safetyMarginMin = 10,
  parkingBufferMin = 10
): {
  leaveByTime: string; // HH:MM
  leaveByFormatted: string; // e.g. "9:15 AM"
  totalBufferMin: number;
} {
  const [h, m] = firstVisitStartTime.split(':').map(Number);
  const totalFirstMin = (isNaN(h) ? 10 : h) * 60 + (isNaN(m) ? 0 : m);
  const totalDeduction = driveTimeMin + parkingBufferMin + safetyMarginMin;
  let leaveMin = totalFirstMin - totalDeduction;
  if (leaveMin < 0) leaveMin += 24 * 60;

  const leaveH = Math.floor(leaveMin / 60) % 24;
  const leaveM = leaveMin % 60;
  const leaveByTime = `${String(leaveH).padStart(2, '0')}:${String(leaveM).padStart(2, '0')}`;
  
  const ampm = leaveH >= 12 ? 'PM' : 'AM';
  const displayH = leaveH % 12 === 0 ? 12 : leaveH % 12;
  const leaveByFormatted = `${displayH}:${String(leaveM).padStart(2, '0')} ${ampm}`;

  return {
    leaveByTime,
    leaveByFormatted,
    totalBufferMin: totalDeduction
  };
}

// 6. Live contact window validation: 10:00 AM – 4:00 PM local time
export function isWithinLiveContactWindow(
  timeStr: string,
  windowStart = '10:00',
  windowEnd = '16:00'
): boolean {
  if (!timeStr) return true;
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const val = toMin(timeStr);
  const start = toMin(windowStart);
  const end = toMin(windowEnd);
  return val >= start && val <= end;
}

// 7. Activity durations
export function getDefaultDurationMinutes(activityType: ActivityType, purpose = ''): number {
  switch (activityType) {
    case 'in_person':
      if (purpose.toLowerCase().includes('first') || purpose.toLowerCase().includes('discovery')) return 45;
      if (purpose.toLowerCase().includes('contract') || purpose.toLowerCase().includes('signing')) return 45;
      if (purpose.toLowerCase().includes('onboarding') || purpose.toLowerCase().includes('training')) return 60;
      if (purpose.toLowerCase().includes('keyfetch') || purpose.toLowerCase().includes('topup') || purpose.toLowerCase().includes('top-up')) return 20;
      return 30; // standard follow-up / check-in
    case 'phone':
      return 15;
    case 'meet':
      return 30;
    case 'email':
      return 5;
    case 'text':
      return 2;
  }
}

// 8. Find top 2-3 realistic slots inside the 10:00 AM - 4:00 PM window
export function findBestSlots(
  targetDurationMin: number,
  existingSlots: PlanSlot[],
  driveTimeMin = 15,
  windowStart = '10:00',
  windowEnd = '16:00'
): SlotSuggestion[] {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const toTimeStr = (min: number) => {
    const h = Math.floor(min / 60) % 24;
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  const format12h = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const dh = h % 12 === 0 ? 12 : h % 12;
    return `${dh}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const winStartMin = toMin(windowStart);
  const winEndMin = toMin(windowEnd);

  // Filter occupied intervals
  const occupied = existingSlots
    .filter(s => s.status !== 'skipped' && s.status !== 'not_scheduled')
    .map(s => {
      const sStart = toMin(s.startTime);
      const sEnd = sStart + s.durationMin;
      return { start: sStart, end: sEnd, name: s.dealershipName };
    })
    .sort((a, b) => a.start - b.start);

  const candidates: SlotSuggestion[] = [];

  // Check 10:00 AM start
  let currentMin = winStartMin;
  if (occupied.length === 0) {
    return [
      {
        time: '10:30',
        label: '10:30 AM',
        reason: 'Optimal mid-morning opening in the Live Contact Window',
        driveTimeMin,
        fitsComfortably: true
      },
      {
        time: '13:30',
        label: '1:30 PM',
        reason: 'Early afternoon after typical dealership sales lunch',
        driveTimeMin,
        fitsComfortably: true
      },
      {
        time: '11:15',
        label: '11:15 AM',
        reason: 'Late morning window before lunch rush',
        driveTimeMin,
        fitsComfortably: true
      }
    ];
  }

  // Find gaps between occupied blocks
  let prevEnd = winStartMin;
  for (const block of occupied) {
    const needed = targetDurationMin + driveTimeMin;
    if (block.start - prevEnd >= needed) {
      const slotStart = prevEnd + driveTimeMin;
      if (slotStart + targetDurationMin <= block.start) {
        const timeStr = toTimeStr(slotStart);
        candidates.push({
          time: timeStr,
          label: format12h(timeStr),
          reason: `Right after previous stop (${driveTimeMin} min drive)`,
          driveTimeMin,
          fitsComfortably: true
        });
      }
    }
    prevEnd = Math.max(prevEnd, block.end);
  }

  // After the last block
  if (winEndMin - prevEnd >= targetDurationMin + driveTimeMin) {
    const slotStart = prevEnd + driveTimeMin;
    const timeStr = toTimeStr(slotStart);
    candidates.push({
      time: timeStr,
      label: format12h(timeStr),
      reason: `Afternoon opening after last stop (${driveTimeMin} min drive)`,
      driveTimeMin,
      fitsComfortably: true
    });
  }

  // Fallback defaults if day is sparse or full
  if (candidates.length < 2) {
    const fallbackOptions = ['10:30', '13:30', '15:00'];
    for (const fb of fallbackOptions) {
      if (!candidates.some(c => c.time === fb)) {
        candidates.push({
          time: fb,
          label: format12h(fb),
          reason: 'Available standard dealership visit window',
          driveTimeMin,
          fitsComfortably: true
        });
      }
      if (candidates.length >= 3) break;
    }
  }

  return candidates.slice(0, 3);
}

// 9. Find dealerships within radius of an anchor dealership (for Trips & clusters)
export function findNearbyDealerships<T extends { id: string; coordinates?: { lat: number; lng: number }; zipCode?: string }>(
  anchor: T,
  candidates: T[],
  maxRadiusMiles = 15
): T[] {
  const anchorCoords = anchor.coordinates || { lat: 33.05, lng: -96.75 };
  return candidates.filter(c => {
    if (c.id === anchor.id) return false;
    const cCoords = c.coordinates || { lat: 33.05, lng: -96.75 };
    const dist = calculateHaversineMiles(
      anchorCoords.lat,
      anchorCoords.lng,
      cCoords.lat,
      cCoords.lng
    );
    return dist <= maxRadiusMiles;
  });
}

// 10. Recalculate Day Schedule
// Re-indexes times deterministically, respects locked meetings, computes leave-by & arrival home
export function recalculateDaySchedule(
  slots: PlanSlot[],
  userHomeCoords: { lat: number; lng: number } | string,
  settings: DaySettings = DEFAULT_DAY_SETTINGS
): DayRecalculationResult {
  const activeSlots = slots
    .filter(s => s.status !== 'skipped' && s.status !== 'not_scheduled')
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const toMin = (t: string) => {
    const [h, m] = (t || '10:00').split(':').map(Number);
    return (isNaN(h) ? 10 : h) * 60 + (isNaN(m) ? 0 : m);
  };
  const toTimeStr = (min: number) => {
    const h = Math.floor(min / 60) % 24;
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  const format12h = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const dh = h % 12 === 0 ? 12 : h % 12;
    return `${dh}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const updatedSlots: PlanSlot[] = [];
  const ruleViolations: DayRecalculationResult['ruleViolations'] = [];
  let totalDriveMin = 0;
  let totalDriveMiles = 0;

  let currentMin = 10 * 60; // default day starts at 10:00 AM

  for (let i = 0; i < activeSlots.length; i++) {
    const slot = { ...activeSlots[i], orderIndex: i };
    let driveMin = 0;

    // Calculate travel time from previous stop or home
    if (slot.activityType === 'in_person') {
      if (i === 0) {
        // From home
        const dist = slot.distanceMiles || 15;
        driveMin = estimateDriveTimeMinutes(dist);
        totalDriveMiles += dist;
      } else {
        const prevSlot = activeSlots[i - 1];
        if (prevSlot.activityType === 'in_person') {
          // Inter-stop distance
          const interDist = Math.max(5, Math.abs(slot.distanceMiles - prevSlot.distanceMiles));
          driveMin = estimateDriveTimeMinutes(interDist);
          totalDriveMiles += interDist;
        } else {
          driveMin = 10; // short buffer
        }
      }
    } else {
      // Remote activity (phone, email, meet) has 0 or 5 min transition
      driveMin = i === 0 ? 0 : 5;
    }

    slot.travelBeforeMin = driveMin;
    totalDriveMin += driveMin;

    if (slot.locked) {
      // Locked slot keeps its start time
      const lockedStart = toMin(slot.startTime);
      currentMin = lockedStart + slot.durationMin;
    } else if (i === 0 && slot.startTime && toMin(slot.startTime) >= 10 * 60) {
      // Anchor first slot to its provided time if >= 10:00 AM
      const scheduledStart = toMin(slot.startTime);
      slot.startTime = toTimeStr(scheduledStart);
      currentMin = scheduledStart + slot.durationMin;
    } else {
      // Flow slot starts after previous stop + drive buffer
      const scheduledStart = Math.max(currentMin + driveMin, 10 * 60);
      slot.startTime = toTimeStr(scheduledStart);
      currentMin = scheduledStart + slot.durationMin;
    }

    // Check rules: Live contact outside 10:00 - 16:00
    if (['in_person', 'phone', 'meet'].includes(slot.activityType)) {
      const slotMin = toMin(slot.startTime);
      if (slotMin > 16 * 60) {
        ruleViolations.push({
          slotId: slot.id,
          dealershipName: slot.dealershipName,
          rule: 'past_4pm',
          message: `${slot.dealershipName} is scheduled past 4:00 PM (${format12h(slot.startTime)}). Dealerships prefer visits during business hours.`
        });
      } else if (slotMin < 10 * 60) {
        ruleViolations.push({
          slotId: slot.id,
          dealershipName: slot.dealershipName,
          rule: 'before_10am',
          message: `${slot.dealershipName} starts before 10:00 AM (${format12h(slot.startTime)}). Morning staff meetings typically run until 10 AM.`
        });
      }
    }

    updatedSlots.push(slot);
  }

  // Calculate Leave-By time from home for the day
  const firstInPerson = updatedSlots.find(s => s.activityType === 'in_person');
  let leaveByTime = '09:15';
  let leaveByFormatted = '9:15 AM';

  if (firstInPerson) {
    const leave = calculateLeaveByTime(
      firstInPerson.startTime,
      firstInPerson.travelBeforeMin || estimateDriveTimeMinutes(firstInPerson.distanceMiles),
      settings.safetyMarginMin,
      settings.parkingBufferMin
    );
    leaveByTime = leave.leaveByTime;
    leaveByFormatted = leave.leaveByFormatted;
  }

  // Calculate estimated arrival home
  const returnDriveMin = firstInPerson ? estimateDriveTimeMinutes(firstInPerson.distanceMiles) : 0;
  const finishMin = currentMin + returnDriveMin;
  const finishTime = toTimeStr(finishMin);
  const finishTimeFormatted = format12h(finishTime);

  // Generate plain-English summary of the day
  let summaryMessage = 'Schedule is balanced and comfortably spaced.';
  if (ruleViolations.length > 0) {
    summaryMessage = ruleViolations[0].message;
  } else if (activeSlots.length > 0) {
    const first = activeSlots[0];
    summaryMessage = `First activity is ${first.dealershipName} at ${format12h(first.startTime)}. Leave home by ${leaveByFormatted}.`;
  }

  return {
    updatedSlots,
    leaveByTime,
    leaveByTimeFormatted: leaveByFormatted,
    finishTime,
    finishTimeFormatted,
    totalDriveMin,
    totalDriveMiles: Math.round(totalDriveMiles),
    ruleViolations,
    summaryMessage
  };
}

// 11. Create individual separate slots for an email batch (Section 6)
export function createEmailBatchSlots(
  dealerships: Array<{ id: string; name: string; city: string; state: string; distanceMiles: number; band: DistanceBand }>,
  userId: string,
  date: string,
  sharedMessage: string,
  startHour = 10,
  startMinute = 15
): PlanSlot[] {
  const batchId = `email_batch_${Date.now()}`;
  return dealerships.map((d, index) => {
    const totalMin = startHour * 60 + startMinute + (index * 10);
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const sendAt = `${date}T${timeStr}:00`;

    return {
      id: `slot_email_${Date.now()}_${index}`,
      userId,
      date,
      timeType: 'exact',
      startTime: timeStr,
      durationMin: 5,
      travelBeforeMin: 0,
      orderIndex: index,
      workType: 'prospect',
      activityType: 'email',
      purpose: 'Product pitch & introduction',
      dealershipId: d.id,
      dealershipName: d.name,
      dealershipCity: d.city,
      dealershipState: d.state,
      distanceBand: d.band,
      distanceMiles: d.distanceMiles,
      sendAt,
      message: sharedMessage,
      batchId,
      source: 'manual',
      status: 'planned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });
}

// 12. Create individual separate slots for a call list (Section 6)
export function createCallListSlots(
  dealerships: Array<{ id: string; name: string; city: string; state: string; distanceMiles: number; band: DistanceBand; workType?: WorkType }>,
  userId: string,
  date: string,
  startHour = 10,
  startMinute = 30
): PlanSlot[] {
  const batchId = `call_list_${Date.now()}`;
  return dealerships.map((d, index) => {
    const totalMin = startHour * 60 + startMinute + (index * 15);
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    return {
      id: `slot_call_${Date.now()}_${index}`,
      userId,
      date,
      timeType: 'exact',
      startTime: timeStr,
      durationMin: 15,
      travelBeforeMin: index === 0 ? 0 : 0,
      orderIndex: index,
      workType: d.workType || 'client',
      activityType: 'phone',
      purpose: 'Follow-up & account check',
      dealershipId: d.id,
      dealershipName: d.name,
      dealershipCity: d.city,
      dealershipState: d.state,
      distanceBand: d.band,
      distanceMiles: d.distanceMiles,
      batchId,
      source: 'manual',
      status: 'planned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });
}

