import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { getTrips } from "../api/index";
import type { Trip } from "../types";
import TripList from "../components/Trip/TripList";

function TripsPage() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadTrips();
  }, []);

  async function loadTrips() {
    try {
      setLoading(true);
      setError("");

      const data = await getTrips();
      setTrips(data);
    } catch (err) {
      setError("Unable to load trips.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function getDestinationCount(_tripId: string): number {
    // Temporary value.
    // We will connect this to the destination API later.
    return 0;
  }

  function getSpentAmount(_tripId: string): number {
    // Temporary value.
    // We will calculate this from activities later.
    return 0;
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

      <TripList
        trips={trips}
        getDestinationCount={getDestinationCount}
        getSpentAmount={getSpentAmount}
        onViewTrip={handleViewTrip}
      />
    </section>
  );
}

export default TripsPage;