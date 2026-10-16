import type { ActivityPayload, DestinationPayload, TripPayload } from "./diffTrip";
import { dateRangesFromCounts } from "./tripDates";
import type { Category } from "../types";
import type { ActivityDraft, DestinationRow, TripFormValues } from "../types/tripForm";

interface BuildArgs {
  form: TripFormValues;
  destinations: DestinationRow[];
  activities: Record<string, ActivityDraft[]>;
  days: string[];
  effectiveDayCounts: number[];
  dayDestinationIndex: number[];
}

/** Everything the API needs, built from what the form already knows. */
export function buildTripPayload({
  form,
  destinations,
  activities,
  days,
  effectiveDayCounts,
  dayDestinationIndex,
}: BuildArgs): { payload: TripPayload; outOfRange: number } {
  const ranges = dateRangesFromCounts(form.startDate, effectiveDayCounts);

  const destinationPayload: DestinationPayload[] = destinations.map((d, i) => {
    const [city, ...rest] = d.name.split(",");
    return {
      id: d.id,
      city: city.trim(),
      country: rest.join(",").trim(),
      arrivalDate: ranges[i]?.arrivalDate ?? "",
      departureDate: ranges[i]?.departureDate ?? "",
    };
  });

  const activityPayload: ActivityPayload[] = [];
  days.forEach((date, i) => {
    const dest = destinationPayload[dayDestinationIndex[i]];
    if (!dest) return;
    (activities[date] ?? [])
      .filter((a) => a.name.trim())
      .forEach((a, j) => {
        activityPayload.push({
          id: a.id,
          destinationId: dest.id,
          title: a.name.trim(),
          category: (a.category || "other") as Category,
          cost: Number(a.cost) || 0,
          date,
          startTime: a.startTime,
          endTime: a.endTime,
          order: j + 1,
        });
      });
  });

  // Activities sitting on days that no longer exist (the dates were shortened).
  const validDays = new Set(days);
  let outOfRange = 0;
  for (const [date, list] of Object.entries(activities)) {
    if (!validDays.has(date)) outOfRange += list.filter((a) => a.name.trim()).length;
  }

  return {
    payload: {
      trip: {
        title: form.title.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        travellers: Number(form.travellers),
        currency: form.currency,
        totalBudget: Number(form.totalBudget),
      },
      destinations: destinationPayload,
      activities: activityPayload,
    },
    outOfRange,
  };
}

/** Named activities whose times the backend would reject: blank, or end not after start. */
export function findInvalidTimes(activities: ActivityPayload[]): ActivityPayload[] {
  return activities.filter((a) => !a.startTime || !a.endTime || a.endTime <= a.startTime);
}