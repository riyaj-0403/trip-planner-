import data from "../data/mock.json";
import type { Trip, Destination, Activity } from "../types";
import { computeChanges, hasChanges, type Changes, type TripPayload } from "../lib/diffTrip";
import { compareActivities } from "../lib/tripDates";

// ─── Mock "database" ──────────────────────────────────────────────────────────
// MOCK-ONLY LAYER: the localStorage persistence below exists so data survives a
// page refresh. Delete it (and keep only the function signatures) when this
// module is switched over to the real Spring Boot API.

const STORAGE_KEY = "tripplanner-db";

interface Db {
  trips: Trip[];
  destinations: Destination[];
  activities: Activity[];
}

function seed(): Db {
  return structuredClone({
    trips: data.trips,
    destinations: data.destinations,
    activities: data.activities,
  }) as unknown as Db;
}

function loadDb(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Db>;
      if (
        Array.isArray(parsed.trips) &&
        Array.isArray(parsed.destinations) &&
        Array.isArray(parsed.activities)
      ) {
        return parsed as Db;
      }
    }
  } catch {
    /* storage unavailable or corrupt: fall back to the seed data */
  }
  return seed();
}

let db: Db = loadDb();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* ignore: the app still works in memory */
  }
}

/** Dev helper: wipe saved data and go back to mock.json. */
export function resetMockData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  db = seed();
}

// ─── Small helpers ────────────────────────────────────────────────────────────

// What the UI sends when creating/updating: the API owns id + timestamps.
type Input<T> = Omit<T, "id" | "createdAt" | "updatedAt">;

const delay = (ms = 400) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();
const copy = <T>(value: T): T => structuredClone(value);

function notFound(what: string): never {
  throw new Error(`${what} not found`);
}

// Synchronous building blocks (no delay, no persist). The public functions below
// wrap these, and the bulk saves reuse them so a save costs one delay, not many.

function insertTrip(input: Input<Trip>): Trip {
  const trip: Trip = { ...input, id: newId(), createdAt: now(), updatedAt: now() };
  db.trips.push(trip);
  return trip;
}

function patchTrip(id: string, patch: Partial<Input<Trip>>): Trip {
  const i = db.trips.findIndex((t) => t.id === id);
  if (i === -1) notFound("Trip");
  db.trips[i] = { ...db.trips[i], ...patch, updatedAt: now() };
  return db.trips[i];
}

function insertDestination(input: Input<Destination>): Destination {
  const destination: Destination = { ...input, id: newId(), createdAt: now(), updatedAt: now() };
  db.destinations.push(destination);
  return destination;
}

function patchDestination(id: string, patch: Partial<Input<Destination>>): Destination {
  const i = db.destinations.findIndex((d) => d.id === id);
  if (i === -1) notFound("Destination");
  db.destinations[i] = { ...db.destinations[i], ...patch, updatedAt: now() };
  return db.destinations[i];
}

function removeDestination(id: string) {
  db.activities = db.activities.filter((a) => a.destinationId !== id);
  db.destinations = db.destinations.filter((d) => d.id !== id);
}

function insertActivity(input: Input<Activity>): Activity {
  const activity: Activity = { ...input, id: newId(), createdAt: now(), updatedAt: now() };
  db.activities.push(activity);
  return activity;
}

function patchActivity(id: string, patch: Partial<Input<Activity>>): Activity {
  const i = db.activities.findIndex((a) => a.id === id);
  if (i === -1) notFound("Activity");
  db.activities[i] = { ...db.activities[i], ...patch, updatedAt: now() };
  return db.activities[i];
}

function removeActivity(id: string) {
  db.activities = db.activities.filter((a) => a.id !== id);
}

function detailsOf(tripId: string) {
  const trip = db.trips.find((t) => t.id === tripId);
  if (!trip) notFound("Trip");
  const tripDests = db.destinations.filter((d) => d.tripId === tripId);
  const destIds = new Set(tripDests.map((d) => d.id));
  const tripActivities = db.activities
    .filter((a) => destIds.has(a.destinationId))
    .sort((a, b) => a.date.localeCompare(b.date) || compareActivities(a, b));
  return { trip, destinations: tripDests, activities: tripActivities };
}

// ─── Trips ────────────────────────────────────────────────────────────────────

export async function getTrips(): Promise<Trip[]> {
  await delay();
  return copy(db.trips);
}

export async function getTrip(id: string): Promise<Trip> {
  await delay();
  const trip = db.trips.find((t) => t.id === id);
  if (!trip) notFound("Trip");
  return copy(trip);
}

/** A trip with its destinations and activities in one call (detail page + edit form).
 *  Activities come back sorted by date, then start time, then order. */
export async function getTripDetails(id: string): Promise<{
  trip: Trip;
  destinations: Destination[];
  activities: Activity[];
}> {
  await delay();
  return copy(detailsOf(id));
}

export async function createTrip(input: Input<Trip>): Promise<Trip> {
  await delay();
  const trip = insertTrip(input);
  persist();
  return copy(trip);
}

export async function updateTrip(id: string, patch: Partial<Input<Trip>>): Promise<Trip> {
  await delay();
  const trip = patchTrip(id, patch);
  persist();
  return copy(trip);
}

// Deleting a trip also removes its destinations and their activities.
export async function deleteTrip(id: string): Promise<void> {
  await delay();
  const destinationIds = new Set(db.destinations.filter((d) => d.tripId === id).map((d) => d.id));
  db.activities = db.activities.filter((a) => !destinationIds.has(a.destinationId));
  db.destinations = db.destinations.filter((d) => d.tripId !== id);
  db.trips = db.trips.filter((t) => t.id !== id);
  persist();
}

// ─── Destinations ─────────────────────────────────────────────────────────────

export async function getDestinations(tripId: string): Promise<Destination[]> {
  await delay();
  return copy(db.destinations.filter((d) => d.tripId === tripId));
}

export async function createDestination(input: Input<Destination>): Promise<Destination> {
  await delay();
  const destination = insertDestination(input);
  persist();
  return copy(destination);
}

export async function updateDestination(
  id: string,
  patch: Partial<Input<Destination>>
): Promise<Destination> {
  await delay();
  const destination = patchDestination(id, patch);
  persist();
  return copy(destination);
}

// Deleting a destination also removes its activities.
export async function deleteDestination(id: string): Promise<void> {
  await delay();
  removeDestination(id);
  persist();
}

// ─── Activities ───────────────────────────────────────────────────────────────

// Main call: used by the destination section (list, sort, reorder, overlap check).
export async function getActivitiesByDestination(destinationId: string): Promise<Activity[]> {
  await delay();
  return copy(db.activities.filter((a) => a.destinationId === destinationId));
}

// Used only for budget totals (trip details summary + "used vs total" on trip cards).
export async function getActivitiesByTrip(tripId: string): Promise<Activity[]> {
  await delay();
  const destinationIds = new Set(db.destinations.filter((d) => d.tripId === tripId).map((d) => d.id));
  return copy(db.activities.filter((a) => destinationIds.has(a.destinationId)));
}

export async function createActivity(input: Input<Activity>): Promise<Activity> {
  await delay();
  const activity = insertActivity(input);
  persist();
  return copy(activity);
}

// Also used for reordering: just send the new startTime / endTime / order / date.
export async function updateActivity(
  id: string,
  patch: Partial<Input<Activity>>
): Promise<Activity> {
  await delay();
  const activity = patchActivity(id, patch);
  persist();
  return copy(activity);
}

export async function deleteActivity(id: string): Promise<void> {
  await delay();
  removeActivity(id);
  persist();
}

// ─── Trip list summaries ──────────────────────────────────────────────────────
// One call gives the list page everything its cards need. (Asking for each trip's
// destinations and activities separately would be one request per trip.)

export interface TripSummary {
  tripId: string;
  destinationCount: number;
  spent: number; // total cost of all activities in the trip
}

export async function getTripSummaries(): Promise<TripSummary[]> {
  await delay();
  return db.trips.map((trip) => {
    const tripDests = db.destinations.filter((d) => d.tripId === trip.id);
    const destIds = new Set(tripDests.map((d) => d.id));
    const spent = db.activities
      .filter((a) => destIds.has(a.destinationId))
      .reduce((sum, a) => sum + a.cost, 0);
    return { tripId: trip.id, destinationCount: tripDests.length, spent };
  });
}

// ─── Whole-trip save (create form + edit form) ────────────────────────────────
// With a real backend this becomes one call (for example PUT /trips/:id with the
// destinations and activities nested), so the save is atomic. Here it is applied
// in a safe order: destinations first (activities point at them), deletions last.

function applyChanges(tripId: string, changes: Changes) {
  // Temporary ids from the form -> real ids of the destinations created now.
  const destIdMap = new Map<string, string>();
  const realDestId = (id: string) => destIdMap.get(id) ?? id;

  if (Object.keys(changes.trip).length > 0) patchTrip(tripId, changes.trip);

  for (const d of changes.destinations.toCreate) {
    const created = insertDestination({
      tripId,
      city: d.city,
      country: d.country,
      arrivalDate: d.arrivalDate,
      departureDate: d.departureDate,
    });
    destIdMap.set(d.id, created.id);
  }
  for (const { id, patch } of changes.destinations.toUpdate) {
    patchDestination(id, patch);
  }

  for (const a of changes.activities.toCreate) {
    insertActivity({
      destinationId: realDestId(a.destinationId),
      title: a.title,
      category: a.category,
      cost: a.cost,
      date: a.date,
      startTime: a.startTime,
      endTime: a.endTime,
      order: a.order,
    });
  }
  for (const { id, patch } of changes.activities.toUpdate) {
    patchActivity(id, {
      ...patch,
      ...(patch.destinationId !== undefined ? { destinationId: realDestId(patch.destinationId) } : {}),
    });
  }

  // Activities first, then destinations. Activities of a deleted destination are
  // removed by removeDestination, so the diff does not list them separately.
  for (const id of changes.activities.toDelete) removeActivity(id);
  for (const id of changes.destinations.toDelete) removeDestination(id);

  // Anything changed under the trip counts as the trip being modified.
  if (hasChanges(changes)) patchTrip(tripId, {});
}

/** Create a trip together with its destinations and day-wise activities. */
export async function createTripDetails(payload: TripPayload): Promise<Trip> {
  await delay();
  const trip = insertTrip(payload.trip);
  const empty = { trip, destinations: [], activities: [] };
  applyChanges(trip.id, computeChanges(empty, payload));
  persist();
  return copy(db.trips.find((t) => t.id === trip.id) as Trip);
}

/** Save an edited trip: only rows that really changed are touched. */
export async function saveTripDetails(tripId: string, payload: TripPayload): Promise<Trip> {
  await delay();
  const original = detailsOf(tripId);
  applyChanges(tripId, computeChanges(original, payload));
  persist();
  return copy(db.trips.find((t) => t.id === tripId) as Trip);
}