import type { Activity } from "../types";

/**
 * Date helpers shared by the form, the detail page and the API.
 *
 * Every function works on "YYYY-MM-DD" strings and does its maths in UTC, so the
 * result is the same in every timezone. (Mixing local-time parsing with
 * toISOString() shifts dates by one day in timezones ahead of UTC, such as IST.)
 */

const DAY_MS = 86_400_000;

/** "2026-11-05" -> UTC midnight in ms. */
export function parseIso(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDaysIso(iso: string, offset: number): string {
  return new Date(parseIso(iso) + offset * DAY_MS).toISOString().slice(0, 10);
}

/** Number of days from start to end, inclusive. 0 if either is missing or end < start. */
export function dayCountBetween(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 0;
  return Math.max(0, Math.round((parseIso(endIso) - parseIso(startIso)) / DAY_MS) + 1);
}

/** Every date from start to end, inclusive. */
export function eachDay(startIso: string, endIso: string): string[] {
  const n = dayCountBetween(startIso, endIso);
  return Array.from({ length: n }, (_, i) => addDaysIso(startIso, i));
}

/** Split N days across M destinations as evenly as possible (extra days go first). */
export function splitDays(totalDays: number, count: number): number[] {
  if (count <= 0 || totalDays <= 0) return [];
  const base = Math.floor(totalDays / count);
  const extra = totalDays % count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Turn saved destination dates back into "days per destination".
 * Returns null when the dates are missing, out of order, have gaps, or do not
 * cover the whole trip. Callers then fall back to splitDays().
 */
export function dayCountsFromDestinations(
  dests: Array<{ arrivalDate: string; departureDate: string }>,
  tripStart: string,
  tripEnd: string
): number[] | null {
  if (dests.length === 0) return null;
  let expectedStart = tripStart;
  const counts: number[] = [];
  for (const d of dests) {
    if (!d.arrivalDate || !d.departureDate) return null;
    if (d.arrivalDate !== expectedStart) return null;
    const n = dayCountBetween(d.arrivalDate, d.departureDate);
    if (n < 1) return null;
    counts.push(n);
    expectedStart = addDaysIso(d.departureDate, 1);
  }
  const total = counts.reduce((a, b) => a + b, 0);
  return total === dayCountBetween(tripStart, tripEnd) ? counts : null;
}

/** Days per destination -> arrival/departure date for each destination. */
export function dateRangesFromCounts(
  tripStart: string,
  counts: number[]
): Array<{ arrivalDate: string; departureDate: string }> {
  let offset = 0;
  return counts.map((n) => {
    const range = {
      arrivalDate: addDaysIso(tripStart, offset),
      departureDate: addDaysIso(tripStart, offset + n - 1),
    };
    offset += n;
    return range;
  });
}

/** One sort order for activities everywhere: start time, then saved order. */
export function compareActivities(
  a: Pick<Activity, "startTime" | "order">,
  b: Pick<Activity, "startTime" | "order">
): number {
  const byTime = (a.startTime ?? "").localeCompare(b.startTime ?? "");
  return byTime !== 0 ? byTime : (a.order ?? 0) - (b.order ?? 0);
}