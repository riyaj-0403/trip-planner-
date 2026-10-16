import type { DraftShape } from "../types/tripForm";
import { getUser } from "./authStorage";

// Draft persistence with per-mode keys (one draft for "new", one per edited trip).

function getDraftKey(tripId?: string): string {
  const uid = getUser()?.id ?? "anon";
  return tripId ? `trip-draft-${uid}-${tripId}` : `trip-draft-${uid}-new`;
}

export function loadDraft(tripId?: string): DraftShape | null {
  try {
    const raw = localStorage.getItem(getDraftKey(tripId));
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<DraftShape>;
    if (!d.form || !Array.isArray(d.destinations) || !d.activities) return null;
    return {
      form: d.form,
      destinations: d.destinations,
      activities: d.activities,
      adjustedDayCounts: Array.isArray(d.adjustedDayCounts) ? d.adjustedDayCounts : [],
      baseUpdatedAt: d.baseUpdatedAt ?? null,
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: DraftShape, tripId?: string) {
  try {
    localStorage.setItem(getDraftKey(tripId), JSON.stringify(draft));
  } catch { /* ignore */ }
}

export function clearDraft(tripId?: string) {
  try {
    localStorage.removeItem(getDraftKey(tripId));
  } catch { /* ignore */ }
}
