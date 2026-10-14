export interface ActivityDraft {
  id: string;
  name: string;
  category: string;
  startTime: string;
  endTime: string;
  cost: string;
}

export interface DestinationRow {
  id: string;
  name: string;
}

export interface TripFormValues {
  title: string;
  startDate: string;
  endDate: string;
  travellers: string;
  currency: string;
  totalBudget: string;
}

export type DraftShape = {
  form: TripFormValues;
  destinations: DestinationRow[];
  activities: Record<string, ActivityDraft[]>;
  adjustedDayCounts: number[];
  /** trip.updatedAt when the draft started (edit mode). A draft is stale if the trip changed since. */
  baseUpdatedAt: string | null;
};
