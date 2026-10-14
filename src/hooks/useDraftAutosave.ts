import { useEffect, useRef, type MutableRefObject } from "react";
import { saveDraft } from "../lib/tripDraft";
import type { ActivityDraft, DestinationRow, TripFormValues } from "../types/tripForm";

interface Args {
  form: TripFormValues;
  destinations: DestinationRow[];
  activities: Record<string, ActivityDraft[]>;
  adjustedDayCounts: number[];
  tripId?: string;
  /** False while loading or while an earlier draft is waiting to be restored or discarded. */
  enabled: boolean;
  baseUpdatedAtRef: MutableRefObject<string | null>;
}

/** Saves a draft to localStorage, but only once the user has changed something. */
export function useDraftAutosave({
  form,
  destinations,
  activities,
  adjustedDayCounts,
  tripId,
  enabled,
  baseUpdatedAtRef,
}: Args) {
  // The state as first loaded: nothing is written until it differs from this.
  const baselineRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const snapshot = JSON.stringify({ form, destinations, activities, adjustedDayCounts });
    if (baselineRef.current === null) {
      baselineRef.current = snapshot; // first settled state = "nothing changed yet"
      return;
    }
    if (snapshot === baselineRef.current) return;
    const t = setTimeout(() => {
      saveDraft(
        { form, destinations, activities, adjustedDayCounts, baseUpdatedAt: baseUpdatedAtRef.current },
        tripId
      );
    }, 300);
    return () => clearTimeout(t);
  }, [form, destinations, activities, adjustedDayCounts, tripId, enabled, baseUpdatedAtRef]);
}
