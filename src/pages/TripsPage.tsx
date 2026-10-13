import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, X } from "lucide-react";
import { getTrips, getTripSummaries, type TripSummary } from "../api/index";
import type { Trip } from "../types";
import TripList from "../components/Trip/TripList";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  EMPTY_FILTERS,
  filterTrips,
  hasActiveFilters,
  isDateRangeValid,
  type TripFilters,
} from "../lib/filterTrips";

function TripsPage() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [summaries, setSummaries] = useState<Record<string, TripSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<TripFilters>(EMPTY_FILTERS);

  useEffect(() => {
    let cancelled = false;

    async function loadTrips() {
      try {
        // Trips and their card numbers (destination count, amount spent) arrive together.
        const [tripData, summaryData] = await Promise.all([getTrips(), getTripSummaries()]);
        if (cancelled) return;
        setTrips(tripData);
        setSummaries(Object.fromEntries(summaryData.map((s) => [s.tripId, s])));
      } catch (err) {
        if (cancelled) return;
        setError("Unable to load trips.");
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTrips();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleTrips = useMemo(() => filterTrips(trips, filters), [trips, filters]);
  const filtersActive = hasActiveFilters(filters);
  const rangeValid = isDateRangeValid(filters);

  function updateFilter(field: keyof TripFilters, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function getDestinationCount(tripId: string): number {
    return summaries[tripId]?.destinationCount ?? 0;
  }

  function getSpentAmount(tripId: string): number {
    return summaries[tripId]?.spent ?? 0;
  }

  function handleViewTrip(tripId: string) {
    navigate(`/trips/${tripId}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span>Loading trips...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-center text-destructive">
        {error}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Trips</h1>
        <p className="mt-1 text-muted-foreground">
          Plan and manage all your trips in one place.
        </p>
      </div>

      {trips.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="trip-search">Search by name</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="trip-search"
                  type="search"
                  value={filters.query}
                  onChange={(e) => updateFilter("query", e.target.value)}
                  placeholder="e.g. Goa"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="trip-from">From</Label>
              <Input
                id="trip-from"
                type="date"
                value={filters.from}
                onChange={(e) => updateFilter("from", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="trip-to">To</Label>
              <Input
                id="trip-to"
                type="date"
                value={filters.to}
                onChange={(e) => updateFilter("to", e.target.value)}
              />
            </div>
            {filtersActive && (
              <Button type="button" variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>
                <X className="size-4" />
                Clear
              </Button>
            )}
          </div>

          {!rangeValid && (
            <p role="alert" className="text-sm text-destructive">
              The "From" date is after the "To" date, so the date filter is ignored.
            </p>
          )}
          {filtersActive && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Showing {visibleTrips.length} of {trips.length} trip{trips.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}

      {trips.length > 0 && visibleTrips.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <p className="font-medium text-foreground">No trips match your search.</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different name or date range.</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear search
          </Button>
        </div>
      ) : (
      <TripList
        trips={visibleTrips}
        getDestinationCount={getDestinationCount}
        getSpentAmount={getSpentAmount}
        onViewTrip={handleViewTrip}
      />
      )}
    </section>
  );
}

export default TripsPage;