import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getTrip } from "../api/index";
import type { Trip } from "../types";
// import "./TripsPage.css";

function TripDetails() {
  const { tripId } = useParams();
  const navigate = useNavigate();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTrip() {
      try {
        setLoading(true);
        setError("");
        const data = await getTrip(tripId as string);
        setTrip(data);
      } catch (err) {
        setError("Unable to load this trip.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadTrip();
  }, [tripId]);

  if (loading) return <div className="page-message">Loading trip...</div>;
  if (error || !trip) return <div className="page-message error">{error}</div>;

  return (
    <main className="trips-page">
      <button onClick={() => navigate("/")}>← Back to trips</button>
      <h1>{trip.title}</h1>
      <p>
        {trip.startDate} to {trip.endDate}
      </p>
    </main>
  );
}

export default TripDetails;