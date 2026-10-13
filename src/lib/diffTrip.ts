import type { Activity, Category, Destination, Trip } from "../types";

/**
 * The full shape of a trip as the form hands it to the API.
 *
 * The form already knows every destination's dates and every activity's
 * destination, date and position, so it sends them explicitly and nothing has to
 * be re-guessed here.
 *
 * New rows carry a temporary id made by the form. The API decides which rows are
 * new by checking whether the id was in the data it loaded (never by what the id
 * looks like).
 */

export interface TripFields {
  title: string;
  startDate: string;
  endDate: string;
  travellers: number;
  currency: string;
  totalBudget: number;
}

export interface DestinationPayload {
  id: string;
  city: string;
  country: string;
  arrivalDate: string;
  departureDate: string;
}

export interface ActivityPayload {
  id: string;
  destinationId: string; // may be a temporary id if the destination is new
  title: string;
  category: Category;
  cost: number;
  date: string;
  startTime: string;
  endTime: string;
  order: number; // 1-based position within the day
}

export interface TripPayload {
  trip: TripFields;
  destinations: DestinationPayload[];
  activities: ActivityPayload[];
}

export interface OriginalTrip {
  trip: Trip;
  destinations: Destination[];
  activities: Activity[];
}

type DestinationFields = Omit<DestinationPayload, "id">;
type ActivityFields = Omit<ActivityPayload, "id">;

export interface Patch<T> {
  id: string;
  patch: Partial<T>;
}

export interface Changes {
  /** Only the trip fields that differ. Empty object = nothing changed. */
  trip: Partial<TripFields>;
  destinations: {
    toCreate: DestinationPayload[];
    toUpdate: Array<Patch<DestinationFields>>;
    toDelete: string[];
  };
  activities: {
    toCreate: ActivityPayload[];
    toUpdate: Array<Patch<ActivityFields>>;
    /** Activities removed on their own. Ones that vanish with a deleted destination are left out. */
    toDelete: string[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function diffFields<T extends object>(original: T, next: T): Partial<T> {
  const patch: Partial<T> = {};
  for (const key of Object.keys(next) as Array<keyof T>) {
    if (original[key] !== next[key]) patch[key] = next[key];
  }
  return patch;
}

const hasKeys = (o: object) => Object.keys(o).length > 0;

const pickTrip = (t: Trip): TripFields => ({
  title: t.title,
  startDate: t.startDate,
  endDate: t.endDate,
  travellers: t.travellers,
  currency: t.currency,
  totalBudget: t.totalBudget,
});

const pickDestination = (d: Destination | DestinationPayload): DestinationFields => ({
  city: d.city,
  country: d.country,
  arrivalDate: d.arrivalDate,
  departureDate: d.departureDate,
});

const pickActivity = (a: Activity | ActivityPayload): ActivityFields => ({
  destinationId: a.destinationId,
  title: a.title,
  category: a.category,
  cost: a.cost,
  date: a.date,
  startTime: a.startTime,
  endTime: a.endTime,
  order: a.order,
});

// ─── The diff ─────────────────────────────────────────────────────────────────

/**
 * Compare what was loaded with what the form now holds.
 * A row is "existing" only if its id was in the loaded data.
 */
export function computeChanges(original: OriginalTrip, edited: TripPayload): Changes {
  const originalDestinations = new Map(original.destinations.map((d) => [d.id, d]));
  const originalActivities = new Map(original.activities.map((a) => [a.id, a]));

  // Destinations
  const destCreate: DestinationPayload[] = [];
  const destUpdate: Array<Patch<DestinationFields>> = [];
  for (const d of edited.destinations) {
    const before = originalDestinations.get(d.id);
    if (!before) {
      destCreate.push(d);
      continue;
    }
    const patch = diffFields(pickDestination(before), pickDestination(d));
    if (hasKeys(patch)) destUpdate.push({ id: d.id, patch });
  }
  const keptDestinations = new Set(edited.destinations.map((d) => d.id));
  const destDelete = original.destinations.filter((d) => !keptDestinations.has(d.id)).map((d) => d.id);
  const deletedDestinations = new Set(destDelete);

  // Activities
  const actCreate: ActivityPayload[] = [];
  const actUpdate: Array<Patch<ActivityFields>> = [];
  for (const a of edited.activities) {
    const before = originalActivities.get(a.id);
    if (!before) {
      actCreate.push(a);
      continue;
    }
    const patch = diffFields(pickActivity(before), pickActivity(a));
    if (hasKeys(patch)) actUpdate.push({ id: a.id, patch });
  }
  const keptActivities = new Set(edited.activities.map((a) => a.id));
  const actDelete = original.activities
    .filter((a) => !keptActivities.has(a.id) && !deletedDestinations.has(a.destinationId))
    .map((a) => a.id);

  return {
    trip: diffFields(pickTrip(original.trip), edited.trip),
    destinations: { toCreate: destCreate, toUpdate: destUpdate, toDelete: destDelete },
    activities: { toCreate: actCreate, toUpdate: actUpdate, toDelete: actDelete },
  };
}

export function hasChanges(c: Changes): boolean {
  return (
    hasKeys(c.trip) ||
    c.destinations.toCreate.length > 0 ||
    c.destinations.toUpdate.length > 0 ||
    c.destinations.toDelete.length > 0 ||
    c.activities.toCreate.length > 0 ||
    c.activities.toUpdate.length > 0 ||
    c.activities.toDelete.length > 0
  );
}