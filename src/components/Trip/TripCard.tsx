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
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl text-foreground font-semibold m-0 break-words">{trip.title}</h2>
      </div>

      {/* Info grid - stack on mobile, grid on sm+ */}
      <div className="flex flex-col gap-3 sm:grid sm:grid-cols-3 sm:gap-3">
        <div className="flex flex-col gap-1.5 text-sm text-foreground min-w-0">
          <span className="text-xs text-muted-foreground font-medium">Dates</span>
          <span className="break-words">{trip.startDate} - {trip.endDate}</span>
        </div>

        <div className="flex flex-col gap-1.5 text-sm text-foreground min-w-0">
          <span className="text-xs text-muted-foreground font-medium">Travellers</span>
          <span>{trip.travellers}</span>
        </div>

        <div className="flex flex-col gap-1.5 text-sm text-foreground min-w-0">
          <span className="text-xs text-muted-foreground font-medium">Destinations</span>
          <span>{destinationCount}</span>
        </div>
      </div>

      {/* Budget section */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-baseline text-sm text-foreground gap-2">
          <span className="text-xs text-muted-foreground font-medium flex-shrink-0">Budget</span>
          <span className="text-xs sm:text-sm font-semibold break-words text-right">
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
          <span className="break-words">
            Remaining: {trip.currency} {remaining.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Action button - full width on mobile */}
      <Button className="w-full" onClick={() => onView(trip.id)}>
        View Trip →
      </Button>
    </div>
  );
}

export default TripCard;