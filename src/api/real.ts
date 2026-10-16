import type { Activity, Category, Destination, Trip } from "../types";
import type { TripPayload } from "../lib/diffTrip";
import { compareActivities } from "../lib/tripDates";
import { request } from "./http";
import type { TripSummary } from "./mock";

// ─── Real API layer (Spring Boot backend) ─────────────────────────────────────
// Same exported function names and signatures as ./mock, so no page changes.
// Everything that differs between the frontend types and the backend lives HERE:
//   ids        string  <-> number
//   dates      arrivalDate/departureDate <-> startDate/endDate
//   category   "food" <-> "FOOD"
//   times      "HH:mm" <-> "HH:mm:ss"
//   shape      flat trip/destinations/activities <-> nested trip tree

type Input<T> = Omit<T, "id" | "createdAt" | "updatedAt">;

// ─── Backend shapes (what the JSON looks like) ────────────────────────────────

interface ActivityDto {
  id: number;
  destinationId?: number; // not sent yet; backend task B15
  title: string;
  date: string;
  category: string;
  cost: number | string;
  startTime?: string | null;
  endTime?: string | null;
  sortOrder?: number | null; // position inside the destination, set by the backend
  createdAt: string;
  updatedAt: string;
}

interface DestinationDto {
  id: number;
  tripId?: number; // not sent yet; backend task B15
  city: string;
  country?: string | null;
  startDate: string;
  endDate: string;
  days?: number;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
  activities?: ActivityDto[];
}

interface TripDto {
  id: number;
  title: string;
  country?: string | null;
  startDate: string;
  endDate: string;
  travellers: number;
  currency: string;
  totalBudget: number | string;
  createdAt: string;
  updatedAt: string;
  destinations?: DestinationDto[];
}

interface PageDto<T> {
  content: T[];
}

// ─── Converters: backend -> frontend ──────────────────────────────────────────

const CATEGORIES: Category[] = ["transport", "food", "sightseeing", "adventure", "shopping", "stay", "other"];

function toCategory(value: string): Category {
  const lower = value.toLowerCase();
  return (CATEGORIES as string[]).includes(lower) ? (lower as Category) : "other";
}

/** "14:00:00" -> "14:00" */
const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : "");

function toTrip(dto: TripDto): Trip {
  return {
    id: String(dto.id),
    title: dto.title,
    startDate: dto.startDate,
    endDate: dto.endDate,
    travellers: dto.travellers,
    currency: dto.currency,
    totalBudget: Number(dto.totalBudget),
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  } as Trip;
}

function toDestination(dto: DestinationDto, tripId: string): Destination {
  return {
    id: String(dto.id),
    tripId: dto.tripId != null ? String(dto.tripId) : tripId,
    city: dto.city,
    country: dto.country ?? "",
    arrivalDate: dto.startDate,
    departureDate: dto.endDate,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  } as Destination;
}

function toActivity(dto: ActivityDto, destinationId: string): Activity {
  return {
    id: String(dto.id),
    destinationId: dto.destinationId != null ? String(dto.destinationId) : destinationId,
    title: dto.title,
    category: toCategory(dto.category),
    cost: Number(dto.cost),
    date: dto.date,
    startTime: hhmm(dto.startTime),
    endTime: hhmm(dto.endTime),
    order: dto.sortOrder ?? 0,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  } as Activity;
}

const byDayThenTime = (a: Activity, b: Activity) => a.date.localeCompare(b.date) || compareActivities(a, b);

/** Nested trip response -> the flat { trip, destinations, activities } the pages use. */
function flatten(dto: TripDto) {
  const trip = toTrip(dto);
  const destinations: Destination[] = [];
  const activities: Activity[] = [];

  for (const d of dto.destinations ?? []) {
    const destination = toDestination(d, trip.id);
    destinations.push(destination);

    const list = (d.activities ?? []).map((a) => toActivity(a, destination.id));
    list.sort(byDayThenTime);

    // Until the backend stores the order (task B5), number the activities of each day by position.
    const perDay = new Map<string, number>();
    for (const a of list) {
      if (!a.order) {
        const next = (perDay.get(a.date) ?? 0) + 1;
        perDay.set(a.date, next);
        a.order = next;
      }
      activities.push(a);
    }
  }

  activities.sort(byDayThenTime);
  return { trip, destinations, activities };
}

// ─── Converters: frontend -> backend ──────────────────────────────────────────

interface ActivityFields {
  title: string;
  category: Category;
  cost: number;
  date: string;
  startTime: string;
  endTime: string;
  order: number;
}

/** Real backend ids are digits only. Temporary ids made by the form are UUIDs, so they are sent as "no id" (= create). */
const isRealId = (id: string) => /^\d+$/.test(id);
const numId = (id: string) => Number(id);

/** POST /destinations/:id/activities?date=...  The date goes in the URL; the backend sets the order. */
function activityCreateBody(a: ActivityFields) {
  return {
    title: a.title,
    category: a.category.toUpperCase(),
    cost: a.cost,
    startTime: a.startTime,
    endTime: a.endTime,
  };
}

/** For PATCH: only the fields that were actually given (an empty time is left out, not sent). */
function activityPatchBody(patch: Partial<Input<Activity>>) {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.date !== undefined) body.date = patch.date;
  if (patch.category !== undefined) body.category = patch.category.toUpperCase();
  if (patch.cost !== undefined) body.cost = patch.cost;
  if (patch.startTime) body.startTime = patch.startTime;
  if (patch.endTime) body.endTime = patch.endTime;
  if (patch.order !== undefined) body.sortOrder = patch.order;
  return body;
}

/** Inclusive number of days between two YYYY-MM-DD dates (1 Nov to 5 Nov = 5). */
function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/** The backend wants a number of days, not dates; it works the dates out itself. */
function destinationBody(d: { city: string; country: string; arrivalDate: string; departureDate: string }) {
  return { city: d.city, country: d.country, days: daysBetween(d.arrivalDate, d.departureDate) };
}

function destinationPatchBody(patch: Partial<Input<Destination>>) {
  const body: Record<string, unknown> = {};
  if (patch.city !== undefined) body.city = patch.city;
  if (patch.country !== undefined) body.country = patch.country;
  if (patch.arrivalDate !== undefined && patch.departureDate !== undefined) {
    body.days = daysBetween(patch.arrivalDate, patch.departureDate);
  }
  return body;
}

// ─── Trip list (cached for a moment so the list page's two calls share one request) ───

let listPromise: Promise<TripDto[]> | null = null;
let listAt = 0;

function fetchTripList(): Promise<TripDto[]> {
  const t = Date.now();
  if (listPromise && t - listAt < 2000) return listPromise;
  listAt = t;
  listPromise = request<PageDto<TripDto>>("/trips?page=0&size=500")
    .then((page) => page.content)
    .catch((err) => {
      listPromise = null;
      throw err;
    });
  return listPromise;
}

const invalidateList = () => {
  listPromise = null;
};

// ─── Trips ────────────────────────────────────────────────────────────────────

export async function getTrips(): Promise<Trip[]> {
  return (await fetchTripList()).map(toTrip);
}

/** A trip with its destinations and activities in one call (detail page + edit form). */
export async function getTripDetails(id: string): Promise<{
  trip: Trip;
  destinations: Destination[];
  activities: Activity[];
}> {
  return flatten(await request<TripDto>(`/trips/${id}`));
}

export async function createTrip(input: Input<Trip>): Promise<Trip> {
  const dto = await request<TripDto>("/trips", {
    method: "POST",
    body: { ...input, destinations: [] },
  });
  invalidateList();
  return toTrip(dto);
}

/**
 * Change some trip fields. The backend's PUT wants the whole trip, so this loads the
 * current trip, applies the change, and saves everything back through saveTripDetails.
 */
export async function updateTrip(id: string, patch: Partial<Input<Trip>>): Promise<Trip> {
  const current = await getTripDetails(id);
  const t = { ...current.trip, ...patch };
  return saveTripDetails(id, {
    trip: {
      title: t.title,
      startDate: t.startDate,
      endDate: t.endDate,
      travellers: t.travellers,
      currency: t.currency,
      totalBudget: t.totalBudget,
    },
    destinations: current.destinations.map((d) => ({
      id: d.id,
      city: d.city,
      country: d.country,
      arrivalDate: d.arrivalDate,
      departureDate: d.departureDate,
    })),
    activities: current.activities.map((a) => ({
      id: a.id,
      destinationId: a.destinationId,
      title: a.title,
      category: a.category,
      cost: a.cost,
      date: a.date,
      startTime: a.startTime,
      endTime: a.endTime,
      order: a.order,
    })),
  });
}

export async function deleteTrip(id: string): Promise<void> {
  await request(`/trips/${id}`, { method: "DELETE" });
  invalidateList();
}

// ─── Destinations ─────────────────────────────────────────────────────────────

export async function getDestinations(tripId: string): Promise<Destination[]> {
  const list = await request<DestinationDto[]>(`/trips/${tripId}/destinations`);
  return list.map((d) => toDestination(d, tripId));
}

export async function createDestination(input: Input<Destination>): Promise<Destination> {
  const dto = await request<DestinationDto>(`/trips/${input.tripId}/destinations`, {
    method: "POST",
    body: destinationBody(input),
  });
  invalidateList();
  return toDestination(dto, input.tripId);
}

export async function updateDestination(
  id: string,
  patch: Partial<Input<Destination>>
): Promise<Destination> {
  const dto = await request<DestinationDto>(`/destinations/${id}`, {
    method: "PATCH",
    body: destinationPatchBody(patch),
  });
  invalidateList();
  return toDestination(dto, patch.tripId ?? "");
}

export async function deleteDestination(id: string): Promise<void> {
  await request(`/destinations/${id}`, { method: "DELETE" });
  invalidateList();
}

// ─── Activities ───────────────────────────────────────────────────────────────

export async function getActivitiesByDestination(destinationId: string): Promise<Activity[]> {
  const list = await request<ActivityDto[]>(`/destinations/${destinationId}/activities`);
  return list.map((a) => toActivity(a, destinationId)).sort(byDayThenTime);
}

// Used for budget totals. Read from the nested trip so every activity knows its destination.
export async function getActivitiesByTrip(tripId: string): Promise<Activity[]> {
  return (await getTripDetails(tripId)).activities;
}

export async function createActivity(input: Input<Activity>): Promise<Activity> {
  const dto = await request<ActivityDto>(
    `/destinations/${input.destinationId}/activities?date=${input.date}`,
    { method: "POST", body: activityCreateBody(input) }
  );
  invalidateList();
  return toActivity(dto, input.destinationId);
}

// Also used for reordering: send the new startTime / endTime / order / date.
// Moving an activity to another destination is not supported by PATCH; the whole-trip
// save (saveTripDetails) handles that.
export async function updateActivity(
  id: string,
  patch: Partial<Input<Activity>>
): Promise<Activity> {
  const dto = await request<ActivityDto>(`/activities/${id}`, {
    method: "PATCH",
    body: activityPatchBody(patch),
  });
  invalidateList();
  return toActivity(dto, patch.destinationId ?? "");
}

export async function deleteActivity(id: string): Promise<void> {
  await request(`/activities/${id}`, { method: "DELETE" });
  invalidateList();
}

// ─── Trip list summaries ──────────────────────────────────────────────────────

export async function getTripSummaries(): Promise<TripSummary[]> {
  const trips = await fetchTripList();
  return trips.map((trip) => {
    const destinations = trip.destinations ?? [];
    const spent = destinations
      .flatMap((d) => d.activities ?? [])
      .reduce((sum, a) => sum + Number(a.cost), 0);
    return { tripId: String(trip.id), destinationCount: destinations.length, spent };
  });
}

// ─── Whole-trip save (create form + edit form) ────────────────────────────────

/**
 * Create a trip with its destinations and activities.
 *   1. POST /trips with the trip fields only (no destinations)
 *   2. PUT /trips/:id with the full tree (destinations in order, with their activities)
 * Step 2 is the backend's "make the trip look exactly like this" save, which keeps the
 * order and the day counts the user chose. (Creating destinations one by one through
 * POST /trips scrambles their order on the backend.)
 * If step 2 fails the half-made trip is deleted, so no stray trips are left behind.
 */
export async function createTripDetails(payload: TripPayload): Promise<Trip> {
  const country = payload.destinations.find((d) => d.country)?.country || undefined;

  const created = await request<TripDto>("/trips", {
    method: "POST",
    body: { ...payload.trip, country, destinations: [] },
  });
  invalidateList();

  try {
    return await saveTripDetails(String(created.id), payload);
  } catch (err) {
    await request(`/trips/${created.id}`, { method: "DELETE" }).catch(() => undefined);
    invalidateList();
    throw err;
  }
}

/**
 * Save an edited trip in one request: PUT /trips/:id with the full final trip.
 * The backend makes its data match it in one transaction: rows without an id are created,
 * rows with an id are updated, and anything left out is deleted. Nothing is saved if it fails.
 *
 * - Destinations are sent in the order shown; the backend numbers them from that order.
 * - Activities are sent per destination, sorted by day, start time, then order; the backend
 *   numbers them from their position in that list.
 */
export async function saveTripDetails(tripId: string, payload: TripPayload): Promise<Trip> {
  const { trip, destinations, activities } = payload;
  const country = destinations.find((d) => d.country)?.country || undefined;

  const body = {
    ...trip,
    country,
    destinations: destinations.map((d) => {
      const { city, country: c, days } = destinationBody(d);
      return {
        ...(isRealId(d.id) ? { id: numId(d.id) } : {}),
        city,
        country: c,
        days,
        activities: activities
          .filter((a) => a.destinationId === d.id)
          .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.order - b.order)
          .map((a) => ({
            ...(isRealId(a.id) ? { id: numId(a.id) } : {}),
            title: a.title,
            date: a.date,
            category: a.category.toUpperCase(),
            cost: a.cost,
            startTime: a.startTime,
            endTime: a.endTime,
          })),
      };
    }),
  };

  const dto = await request<TripDto>(`/trips/${tripId}`, { method: "PUT", body });
  invalidateList();
  return toTrip(dto);
}