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
  order?: number | null; // not sent until backend task B5 is done
  createdAt: string;
  updatedAt: string;
}

interface DestinationDto {
  id: number;
  tripId?: number; // not sent yet; backend task B15
  city: string;
  country?: string | null; // not sent until backend task B3 is done
  startDate: string;
  endDate: string;
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
    order: dto.order ?? 0,
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

/** Real backend ids are digits only. Temporary ids made by the form are UUIDs. */
const isRealId = (id: string) => /^\d+$/.test(id);
const numId = (id: string) => Number(id);

interface ActivityFields {
  title: string;
  category: Category;
  cost: number;
  date: string;
  startTime: string;
  endTime: string;
  order: number;
}

function activityBody(a: ActivityFields) {
  return {
    title: a.title,
    date: a.date,
    category: a.category.toUpperCase(),
    cost: a.cost,
    startTime: a.startTime || null,
    endTime: a.endTime || null,
    order: a.order,
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
  if (patch.order !== undefined) body.order = patch.order;
  return body;
}

function destinationBody(d: { city: string; country: string; arrivalDate: string; departureDate: string }) {
  return { city: d.city, country: d.country, startDate: d.arrivalDate, endDate: d.departureDate };
}

function destinationPatchBody(patch: Partial<Input<Destination>>) {
  const body: Record<string, unknown> = {};
  if (patch.city !== undefined) body.city = patch.city;
  if (patch.country !== undefined) body.country = patch.country;
  if (patch.arrivalDate !== undefined) body.startDate = patch.arrivalDate;
  if (patch.departureDate !== undefined) body.endDate = patch.departureDate;
  return body;
}

/**
 * The whole trip as one nested body (used by POST /trips and PUT /trips/:id).
 * Rows that already exist keep their id; new rows (temporary UUIDs) are sent without one.
 * The trip's country is taken from its first destination (the form has no trip-level country).
 */
function tripTreeBody(payload: TripPayload) {
  const country = payload.destinations.find((d) => d.country)?.country || undefined;

  return {
    ...payload.trip,
    country,
    destinations: payload.destinations.map((d) => ({
      ...(isRealId(d.id) ? { id: numId(d.id) } : {}),
      ...destinationBody(d),
      activities: payload.activities
        .filter((a) => a.destinationId === d.id)
        .map((a) => ({
          ...(isRealId(a.id) ? { id: numId(a.id) } : {}),
          ...activityBody(a),
        })),
    })),
  };
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

export async function updateTrip(id: string, patch: Partial<Input<Trip>>): Promise<Trip> {
  const dto = await request<TripDto>(`/trips/${id}`, { method: "PATCH", body: patch });
  invalidateList();
  return toTrip(dto);
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
  const dto = await request<ActivityDto>(`/destinations/${input.destinationId}/activities`, {
    method: "POST",
    body: activityBody(input),
  });
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

/** Create a trip together with its destinations and day-wise activities (one request). */
export async function createTripDetails(payload: TripPayload): Promise<Trip> {
  const dto = await request<TripDto>("/trips", { method: "POST", body: tripTreeBody(payload) });
  invalidateList();
  return toTrip(dto);
}

/**
 * Save an edited trip in one atomic request: PUT /trips/:id with the full nested tree.
 * Needs backend task B11. Until then the request will fail with 404/405.
 */
export async function saveTripDetails(tripId: string, payload: TripPayload): Promise<Trip> {
  const dto = await request<TripDto>(`/trips/${tripId}`, { method: "PUT", body: tripTreeBody(payload) });
  invalidateList();
  return toTrip(dto);
}