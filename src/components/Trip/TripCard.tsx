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
    <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-6 flex flex-col gap-2.5 sm:gap-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
      {/* Header */}
      <div>
        <h2 className="text-base sm:text-2xl text-foreground font-semibold m-0 break-words line-clamp-2 sm:line-clamp-none">
          {trip.title}
        </h2>
      </div>

      {/* Info grid: dates on their own row on mobile, then two small columns */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 sm:gap-3">
        <div className="col-span-2 sm:col-span-1 flex flex-col gap-0.5 sm:gap-1.5 text-xs sm:text-sm text-foreground min-w-0">
          <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">Dates</span>
          <span className="break-words">{trip.startDate} - {trip.endDate}</span>
        </div>

        <div className="flex flex-col gap-0.5 sm:gap-1.5 text-xs sm:text-sm text-foreground min-w-0">
          <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">Travellers</span>
          <span>{trip.travellers}</span>
        </div>

        <div className="flex flex-col gap-0.5 sm:gap-1.5 text-xs sm:text-sm text-foreground min-w-0">
          <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">Destinations</span>
          <span>{destinationCount}</span>
        </div>
      </div>

      {/* Budget section */}
      <div className="flex flex-col gap-1.5 sm:gap-2">
        <div className="flex justify-between items-baseline text-foreground gap-2">
          <span className="text-[11px] sm:text-xs text-muted-foreground font-medium flex-shrink-0">Budget</span>
          <span className="text-[11px] sm:text-sm font-semibold break-words text-right">
            {trip.currency} {spent.toLocaleString()} /{" "}
            {trip.currency} {trip.totalBudget.toLocaleString()}
          </span>
        </div>

        <div className="w-full h-1.5 sm:h-2 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${budgetPercentage}%` }}
          />
        </div>

        <div className="text-[11px] sm:text-xs text-muted-foreground">
          <span className="break-words">
            Remaining: {trip.currency} {remaining.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Action button */}
      <Button className="w-full h-8 text-xs sm:h-9 sm:text-sm" onClick={() => onView(trip.id)}>
        View Trip →
      </Button>
    </div>
  );
}

export default TripCard;