import type { Trip } from "../types";

/**
 * Filtering for the trips page.
 *
 * - query: matches part of the trip name (ignores upper/lower case)
 * - from / to: keep trips that overlap this date range, i.e. any trip that is
 *   still on or after "from" and has started on or before "to". Either end can
 *   be left empty.
 *
 * Name and dates combine: when both are used, a trip must match both.
 * Dates are "YYYY-MM-DD" strings, so plain string comparison orders them correctly.
 */

export interface TripFilters {
  query: string;
  from: string;
  to: string;
}

export const EMPTY_FILTERS: TripFilters = { query: "", from: "", to: "" };

/** A range with "from" after "to" can never match, so the date filter is ignored. */
export function isDateRangeValid(filters: TripFilters): boolean {
  return !filters.from || !filters.to || filters.from <= filters.to;
}

export function hasActiveFilters(filters: TripFilters): boolean {
  return filters.query.trim() !== "" || filters.from !== "" || filters.to !== "";
}

export function filterTrips(trips: Trip[], filters: TripFilters): Trip[] {
  const query = filters.query.trim().toLowerCase();
  const useDates = isDateRangeValid(filters);

  return trips.filter((trip) => {
    if (query && !trip.title.toLowerCase().includes(query)) return false;
    if (useDates) {
      if (filters.from && trip.endDate < filters.from) return false; // finished before the range
      if (filters.to && trip.startDate > filters.to) return false; // starts after the range
    }
    return true;
  });
}