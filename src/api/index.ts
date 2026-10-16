import * as mock from "./mock";
import * as real from "./real";

// Switch with VITE_USE_MOCK in .env:  true = local mock data, false = Spring Boot backend.
// Pages keep importing from "../api/index" and never know which one is in use.
const impl = import.meta.env.VITE_USE_MOCK === "true" ? mock : real;

export const getTrips = impl.getTrips;
export const getTripDetails = impl.getTripDetails;
export const createTrip = impl.createTrip;
export const updateTrip = impl.updateTrip;
export const deleteTrip = impl.deleteTrip;

export const getDestinations = impl.getDestinations;
export const createDestination = impl.createDestination;
export const updateDestination = impl.updateDestination;
export const deleteDestination = impl.deleteDestination;

export const getActivitiesByDestination = impl.getActivitiesByDestination;
export const getActivitiesByTrip = impl.getActivitiesByTrip;
export const createActivity = impl.createActivity;
export const updateActivity = impl.updateActivity;
export const deleteActivity = impl.deleteActivity;

export const getTripSummaries = impl.getTripSummaries;
export const createTripDetails = impl.createTripDetails;
export const saveTripDetails = impl.saveTripDetails;

export type { TripSummary } from "./mock";
export { resetMockData } from "./mock";
export { ApiError, isNotFound } from "./http";