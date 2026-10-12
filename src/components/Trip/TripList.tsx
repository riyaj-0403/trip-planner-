import type { Trip } from "../../types";
import TripCard from "./TripCard";

interface TripListProps {
  trips: Trip[];
  getDestinationCount: (tripId: string) => number;
  getSpentAmount: (tripId: string) => number;
  onViewTrip: (tripId: string) => void;
}

function TripList({
  trips,
  getDestinationCount,
  getSpentAmount,
  onViewTrip,
}: TripListProps) {
  if (trips.length === 0) {
    return (
      <div className="text-center py-16 px-5 border border-dashed border-border rounded-2xl bg-muted">
        <h2 className="mb-2 text-foreground font-semibold">No trips yet</h2>
        <p className="m-0 text-muted-foreground">Create your first trip to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 lg:grid-cols-2 md:grid-cols-1 gap-5">
      {trips.map((trip) => (
        <TripCard
          key={trip.id}
          trip={trip}
          destinationCount={getDestinationCount(trip.id)}
          spent={getSpentAmount(trip.id)}
          onView={onViewTrip}
        />
      ))}
    </div>
  );
}

export default TripList;