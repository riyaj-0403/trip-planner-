import type { ActivityDraft } from "../types/tripForm";

export const OPTIMAL_HOURS_PER_DAY = 8;

export const TIMING_REVIEW_MESSAGE =
  'Some activities are marked "Timing needs review". Please adjust their timings.';

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  if (!s1 || !e1 || !s2 || !e2) return false;
  return !(toMin(e1) <= toMin(s2) || toMin(e2) <= toMin(s1));
}

/**
 * Ids of activities whose position on screen disagrees with their start time
 * (an activity placed above another one that starts earlier). Activities with
 * no start time yet are ignored.
 */
export function orderConflictIds(list: ActivityDraft[]): string[] {
  const timed = list.filter((a) => a.startTime);
  const ids: string[] = [];
  for (let i = 0; i < timed.length - 1; i++) {
    if (toMin(timed[i].startTime) > toMin(timed[i + 1].startTime)) {
      ids.push(timed[i].id, timed[i + 1].id);
    }
  }
  return ids;
}

/** Ids of activities whose time range intersects another activity in the same day. */
export function overlapIds(list: ActivityDraft[]): string[] {
  const ids: string[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (timesOverlap(list[i].startTime, list[i].endTime, list[j].startTime, list[j].endTime)) {
        ids.push(list[i].id, list[j].id);
      }
    }
  }
  return ids;
}

export function needsTimingReview(list: ActivityDraft[]): boolean {
  return orderConflictIds(list).length > 0 || overlapIds(list).length > 0;
}

export function calculateDayDuration(list: ActivityDraft[]): number {
  return list.reduce((total, a) => {
    if (!a.startTime || !a.endTime) return total;
    return total + Math.max(0, (toMin(a.endTime) - toMin(a.startTime)) / 60);
  }, 0);
}
