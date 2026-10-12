import type { Trip } from "../../types";
import { Button } from "../ui/button";

interface TripCardProps {
  trip: Trip;
  destinationCount: number;
  spent: number;
  onView: (tripId: string) => void;
}

function TripCard({
  trip,
  destinationCount,
  spent,
  onView,
}: TripCardProps) {
  const remaining = trip.totalBudget - spent;

  const budgetPercentage =
    trip.totalBudget > 0
      ? Math.min((spent / trip.totalBudget) * 100, 100)
      : 0;

  return (
    <div className="bg-card border border-border rounded-2xl px-5 py-5 flex flex-col gap-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
      <div className="trip-card-header">
        <h2 className="text-2xl text-foreground font-semibold m-0">{trip.title}</h2>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5 text-sm text-foreground">
          <span className="text-xs text-muted-foreground">Dates</span>
          <span>
            {trip.startDate} - {trip.endDate}
          </span>
        </div>

        <div className="flex flex-col gap-1.5 text-sm text-foreground">
          <span className="text-xs text-muted-foreground">Travellers</span>
          <span>{trip.travellers}</span>
        </div>

        <div className="flex flex-col gap-1.5 text-sm text-foreground">
          <span className="text-xs text-muted-foreground">Destinations</span>
          <span>{destinationCount}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center text-sm text-foreground">
          <span className="text-xs text-muted-foreground">Budget</span>

          <span>
            {trip.currency} {spent.toLocaleString()} /{" "}
            {trip.currency} {trip.totalBudget.toLocaleString()}
          </span>
        </div>

        <div className="w-full h-2 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${budgetPercentage}%` }}
          />
        </div>

        <div className="text-xs text-muted-foreground">
          <span>
            Remaining: {trip.currency} {remaining.toLocaleString()}
          </span>
        </div>
      </div>

      <Button className="w-full" onClick={() => onView(trip.id)}>
        View Trip →
      </Button>
    </div>
  );
}

export default TripCard;