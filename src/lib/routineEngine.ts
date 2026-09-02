// Shared, framework-free clock-time engine for "what's happening right now"
// given a list of time-ranged periods. Used by BOTH the personal Routine
// system (useRoutine.ts) and the Room's shared Routine (useStudyRooms.ts),
// so the two never compute "current period" differently. This is the first
// concrete step of Routine/Room feature parity — one engine, two consumers.

export interface EnginePeriod {
  id: string;
  name: string;
  category?: string | null;
  is_break?: boolean;
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
  alarm_id?: string | null;
  color?: string | null;
  sort_order?: number;
}

// Converts "HH:MM" or "HH:MM:SS" into minutes-since-midnight.
export function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [h, m] = time.slice(0, 5).split(":");
  return Number(h) * 60 + Number(m);
}

// Converts a Date's local time into minutes-since-midnight.
export function dateToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

export function sortPeriods(periods: EnginePeriod[]): EnginePeriod[] {
  return [...periods].sort((a, b) => {
    const diff = timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
    if (diff !== 0) return diff;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
}

// Returns the period whose [start_time, end_time) contains "now", or null.
// If multiple periods overlap the same instant, the first one found in
// sorted order wins (known limitation — see handoff doc Section 7,
// "overlapping-period ambiguity", not solved here on purpose).
export function getCurrentPeriod(periods: EnginePeriod[], now: Date): EnginePeriod | null {
  const nowMin = dateToMinutes(now);
  const sorted = sortPeriods(periods);

  for (const p of sorted) {
    const start = timeToMinutes(p.start_time);
    const end = timeToMinutes(p.end_time);
    if (nowMin >= start && nowMin < end) return p;
  }
  return null;
}

// Returns the next period that hasn't started yet, or null if none remain
// today.
export function getNextPeriod(periods: EnginePeriod[], now: Date): EnginePeriod | null {
  const nowMin = dateToMinutes(now);
  const sorted = sortPeriods(periods);

  for (const p of sorted) {
    const start = timeToMinutes(p.start_time);
    if (start > nowMin) return p;
  }
  return null;
}

// Seconds remaining until a given period's end_time, from "now". Returns 0
// if already past end_time (never negative, so UI never shows "-3s").
export function secondsRemainingInPeriod(period: EnginePeriod, now: Date): number {
  const endMin = timeToMinutes(period.end_time);
  const nowMin = dateToMinutes(now);
  const remainingMin = Math.max(0, endMin - nowMin);
  return Math.round(remainingMin * 60);
}

// Seconds until a given (future) period starts, from "now".
export function secondsUntilPeriod(period: EnginePeriod, now: Date): number {
  const startMin = timeToMinutes(period.start_time);
  const nowMin = dateToMinutes(now);
  const remainingMin = Math.max(0, startMin - nowMin);
  return Math.round(remainingMin * 60);
}

// Splits a sorted period list into completed / current / remaining,
// relative to "now" — used to render the "above = done, highlighted =
// current, below = upcoming" layout both Routine.tsx and the Room Routine
// view share.
export function splitByProgress(
  periods: EnginePeriod[],
  now: Date
): { completed: EnginePeriod[]; current: EnginePeriod | null; remaining: EnginePeriod[] } {
  const sorted = sortPeriods(periods);
  const nowMin = dateToMinutes(now);

  const completed: EnginePeriod[] = [];
  const remaining: EnginePeriod[] = [];
  let current: EnginePeriod | null = null;

  for (const p of sorted) {
    const start = timeToMinutes(p.start_time);
    const end = timeToMinutes(p.end_time);
    if (nowMin >= end) {
      completed.push(p);
    } else if (nowMin >= start && nowMin < end) {
      current = p;
    } else {
      remaining.push(p);
    }
  }

  return { completed, current, remaining };
}

// mm:ss or hh:mm:ss countdown formatter, shared everywhere a remaining-time
// string is shown.
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
