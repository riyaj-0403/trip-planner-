import type { Destination, Activity } from "../types";

/**
 * Compute the set of changes needed to transform the original trip data
 * into the edited form state.
 *
 * Returns { toCreate, toUpdate, toDelete } for both destinations and activities.
 * Items with server-issued IDs are compared; form-generated IDs are treated as new.
 */

export interface ActivityDraft {
  id: string;
  name: string;
  category: string;
  startTime: string;
  endTime: string;
  cost: string;
}

export interface DestinationDraft {
  id: string;
  name: string;
}

export interface Changes {
  destinations: {
    toCreate: Array<{ city: string; country: string }>;
    toUpdate: Array<{ id: string; city: string; country: string }>;
    toDelete: string[]; // IDs to delete
    idMapping: Map<string, string>; // Maps temp ID -> real ID after creation
  };
  activities: {
    toCreate: Array<{
      destinationId: string;
      title: string;
      category: string;
      startTime: string;
      endTime: string;
      cost: number;
      date: string;
      order: number;
    }>;
    toUpdate: Array<{
      id: string;
      title?: string;
      category?: string;
      startTime?: string;
      endTime?: string;
      cost?: number;
    }>;
    toDelete: string[]; // IDs to delete
  };
}

/**
 * Marker to distinguish server IDs from form-generated temporary IDs.
 * Server IDs follow UUID format (8-4-4-4-12).
 */
function isServerId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function computeChanges(
  originalTrip: {
    destinations: Destination[];
    activities: Activity[];
  },
  editedDestinations: DestinationDraft[],
  editedActivities: Record<string, ActivityDraft[]>
): Changes {
  const originalDestIds = new Set(originalTrip.destinations.map((d) => d.id));
  const originalActivityIds = new Set(originalTrip.activities.map((a) => a.id));

  // Flatten edited activities and build day->destIndex mapping
  const allEditedActivities = Object.entries(editedActivities).flatMap(([date, acts]) =>
    acts.map((a, order) => ({ ...a, date, order }))
  );
  const editedActivityIds = new Set(allEditedActivities.map((a) => a.id));

  // ─── Destinations ───────────────────────────────────────────────────────────

  const destToCreate: Array<{ city: string; country: string }> = [];
  const destToUpdate: Array<{ id: string; city: string; country: string }> = [];
  const idMapping = new Map<string, string>();

  // New destinations (form-generated IDs or not in original)
  editedDestinations.forEach((d) => {
    if (!isServerId(d.id)) {
      // Form-generated ID → will become a new destination
      const [city, country] = d.name.split(",").map((s) => s.trim());
      destToCreate.push({ city: city || "", country: country || "" });
    } else if (originalDestIds.has(d.id)) {
      // Server ID that exists in original → check for updates
      const orig = originalTrip.destinations.find((x) => x.id === d.id);
      if (orig) {
        const [city, country] = d.name.split(",").map((s) => s.trim());
        if (city !== orig.city || country !== orig.country) {
          destToUpdate.push({ id: d.id, city, country });
        }
      }
    }
  });

  // Deleted destinations (in original, not in edited)
  const destToDelete = originalTrip.destinations
    .filter((d) => !editedDestinations.some((e) => e.id === d.id))
    .map((d) => d.id);

  // ─── Activities ──────────────────────────────────────────────────────────────

  const actToCreate: Changes["activities"]["toCreate"] = [];
  const actToUpdate: Changes["activities"]["toUpdate"] = [];

  // New activities (form-generated IDs)
  allEditedActivities.forEach((a) => {
    if (!isServerId(a.id)) {
      // Find which destination this activity belongs to
      // by finding its date in the form and mapping to a destination
      const dayIndex = Object.keys(editedActivities).indexOf(a.date);
      if (dayIndex >= 0) {
        const destIndex = calculateDestinationIndex(
          editedDestinations.length,
          dayIndex,
          editedActivities
        );
        if (destIndex >= 0 && destIndex < editedDestinations.length) {
          const destId = editedDestinations[destIndex].id;
          actToCreate.push({
            destinationId: destId,
            title: a.name,
            category: a.category,
            startTime: a.startTime,
            endTime: a.endTime,
            cost: Number(a.cost) || 0,
            date: a.date,
            order: a.order,
          });
        }
      }
    } else if (originalActivityIds.has(a.id)) {
      // Server ID in original → check for updates
      const orig = originalTrip.activities.find((x) => x.id === a.id);
      if (orig) {
        const patch: Changes["activities"]["toUpdate"][0] = { id: a.id };
        let changed = false;
        if (a.name !== orig.title) {
          patch.title = a.name;
          changed = true;
        }
        if (a.category !== orig.category) {
          patch.category = a.category;
          changed = true;
        }
        if (a.startTime !== orig.startTime) {
          patch.startTime = a.startTime;
          changed = true;
        }
        if (a.endTime !== orig.endTime) {
          patch.endTime = a.endTime;
          changed = true;
        }
        if (Number(a.cost) !== orig.cost) {
          patch.cost = Number(a.cost);
          changed = true;
        }
        if (changed) {
          actToUpdate.push(patch);
        }
      }
    }
  });

  // Deleted activities (in original, not in edited)
  const actToDelete = originalTrip.activities
    .filter((a) => !editedActivityIds.has(a.id))
    .map((a) => a.id);

  return {
    destinations: {
      toCreate: destToCreate,
      toUpdate: destToUpdate,
      toDelete: destToDelete,
      idMapping,
    },
    activities: {
      toCreate: actToCreate,
      toUpdate: actToUpdate,
      toDelete: actToDelete,
    },
  };
}

/**
 * Calculate which destination index a given day belongs to.
 * This mimics the form's dayDestinationIndex calculation.
 */
function calculateDestinationIndex(
  destCount: number,
  dayIndex: number,
  activities: Record<string, ActivityDraft[]>
): number {
  if (destCount === 0) return -1;
  const dayCount = Object.keys(activities).length;
  const splitDays = splitDaysCount(dayCount, destCount);
  let cumulative = 0;
  for (let i = 0; i < splitDays.length; i++) {
    cumulative += splitDays[i];
    if (dayIndex < cumulative) return i;
  }
  return destCount - 1;
}

/** Split N days across M destinations evenly */
function splitDaysCount(totalDays: number, destCount: number): number[] {
  if (destCount <= 0 || totalDays <= 0) return [];
  const base = Math.floor(totalDays / destCount);
  const extra = totalDays % destCount;
  return Array.from({ length: destCount }, (_, i) => base + (i < extra ? 1 : 0));
}
