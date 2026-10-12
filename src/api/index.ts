
import data from "../data/mock.json";
import type { Trip, Destination, Activity } from "../types";


// In-memory "database" (resets on page refresh)                       
let trips: Trip[] = structuredClone(data.trips) as Trip[];
let destinations: Destination[] = structuredClone(data.destinations) as Destination[];
let activities: Activity[] = structuredClone(data.activities) as Activity[];


// What the UI sends when creating/updating: the API owns id + timestamps.
type Input<T> = Omit<T, "id" | "createdAt" | "updatedAt">;

const delay = (ms = 400) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

// Return copies of the data
const copy = <T>(value: T): T => structuredClone(value);

function notFound(what: string): never {
  throw new Error(`${what} not found`);
}

// Trips
export async function getTrips(): Promise<Trip[]> {
  await delay();
  return copy(trips);
}

export async function getTrip(id: string): Promise<Trip> {
  await delay();
  const trip = trips.find((t) => t.id === id);
  if (!trip) notFound("Trip");
  return copy(trip);
}

/** Returns a trip with its destinations and activities in one call.
 *  Used by TripDetailPage. */
export async function getTripDetails(id: string): Promise<{
  trip: Trip;
  destinations: Destination[];
  activities: Activity[];
}> {
  await delay();
  const trip = trips.find((t) => t.id === id);
  if (!trip) notFound("Trip");
  const tripDests = destinations.filter((d) => d.tripId === id);
  const destIds = tripDests.map((d) => d.id);
  const tripActivities = activities.filter((a) => destIds.includes(a.destinationId));
  return {
    trip: copy(trip),
    destinations: copy(tripDests),
    activities: copy(tripActivities),
  };
}

export async function createTrip(input: Input<Trip>): Promise<Trip> {
  await delay();
  const trip = { ...input, id: newId(), createdAt: now(), updatedAt: now() } as Trip;
  trips.push(trip);
  return copy(trip);
}

export async function updateTrip(id: string, patch: Partial<Input<Trip>>): Promise<Trip> {
  await delay();
  const i = trips.findIndex((t) => t.id === id);
  if (i === -1) notFound("Trip");
  trips[i] = { ...trips[i], ...patch, updatedAt: now() };
  return copy(trips[i]);
}

// Deleting a trip also removes its destinations and their activities.
export async function deleteTrip(id: string): Promise<void> {
  await delay();
  const destinationIds = destinations.filter((d) => d.tripId === id).map((d) => d.id);
  activities = activities.filter((a) => !destinationIds.includes(a.destinationId));
  destinations = destinations.filter((d) => d.tripId !== id);
  trips = trips.filter((t) => t.id !== id);
}

// Destinations
export async function getDestinations(tripId: string): Promise<Destination[]> {
  await delay();
  return copy(destinations.filter((d) => d.tripId === tripId));
}

export async function createDestination(input: Input<Destination>): Promise<Destination> {
  await delay();
  const destination = { ...input, id: newId(), createdAt: now(), updatedAt: now() } as Destination;
  destinations.push(destination);
  return copy(destination);
}

export async function updateDestination(
  id: string,
  patch: Partial<Input<Destination>>
): Promise<Destination> {
  await delay();
  const i = destinations.findIndex((d) => d.id === id);
  if (i === -1) notFound("Destination");
  destinations[i] = { ...destinations[i], ...patch, updatedAt: now() };
  return copy(destinations[i]);
}

// Deleting a destination also removes its activities.
export async function deleteDestination(id: string): Promise<void> {
  await delay();
  activities = activities.filter((a) => a.destinationId !== id);
  destinations = destinations.filter((d) => d.id !== id);
}

// Activities

// Main call: used by the destination section (list, sort, reorder, overlap check).
export async function getActivitiesByDestination(destinationId: string): Promise<Activity[]> {
  await delay();
  return copy(activities.filter((a) => a.destinationId === destinationId));
}

// Used only for budget totals (trip details summary + "used vs total" on trip cards).
export async function getActivitiesByTrip(tripId: string): Promise<Activity[]> {
  await delay();
  const destinationIds = destinations.filter((d) => d.tripId === tripId).map((d) => d.id);
  return copy(activities.filter((a) => destinationIds.includes(a.destinationId)));
}

export async function createActivity(input: Input<Activity>): Promise<Activity> {
  await delay();
  const activity = { ...input, id: newId(), createdAt: now(), updatedAt: now() } as Activity;
  activities.push(activity);
  return copy(activity);
}

// Also used for reordering: just send the new startTime / endTime / order / date.
export async function updateActivity(
  id: string,
  patch: Partial<Input<Activity>>
): Promise<Activity> {
  await delay();
  const i = activities.findIndex((a) => a.id === id);
  if (i === -1) notFound("Activity");
  activities[i] = { ...activities[i], ...patch, updatedAt: now() };
  return copy(activities[i]);
}

export async function deleteActivity(id: string): Promise<void> {
  await delay();
  activities = activities.filter((a) => a.id !== id);
}