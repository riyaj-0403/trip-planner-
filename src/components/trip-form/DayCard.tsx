import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import DraggableActivityItem from "./DraggableActivityItem";
import type { ActivityDraft } from "../../types/tripForm";

interface Props {
  date: string;
  dayNumber: number;
  list: ActivityDraft[];
  overlapError: string | undefined;
  orderWarning: boolean;
  exceedHours: number | undefined;
  reviewIds: Set<string>;
  /** True while an activity from a different destination is being dragged. */
  locked: boolean;
  onAddActivity: (date: string) => void;
  onUpdate: (date: string, id: string, field: keyof ActivityDraft, value: string) => void;
  onRemove: (date: string, id: string) => void;
}

export default function DayCard({
  date,
  dayNumber,
  list,
  overlapError,
  orderWarning,
  exceedHours,
  reviewIds,
  locked,
  onAddActivity,
  onUpdate,
  onRemove,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date}` });

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "bg-muted/50 rounded-xl p-4 flex flex-col gap-3 shadow-none transition-opacity",
        locked && "opacity-50",
        isOver &&
          (locked
            ? "outline outline-dashed outline-destructive/60"
            : "outline outline-dashed outline-muted-foreground/30")
      )}
    >
      <CardHeader className="flex-row items-baseline justify-between space-y-0 p-0">
        <CardTitle className="text-base">Day {dayNumber}</CardTitle>
        <CardDescription className="text-xs">{date}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 p-0">
        {exceedHours !== undefined && exceedHours > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 text-yellow-900 dark:text-yellow-200 px-3 py-2.5 rounded-lg text-xs font-medium">
            ⚠ {exceedHours.toFixed(1)} hrs exceeded the optimal time
          </div>
        )}

        {orderWarning && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 px-3 py-2.5 rounded-lg text-xs font-medium">
            ⚠ The order of activities doesn't match their start times. Please adjust the timings.
          </div>
        )}

        {overlapError && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-900 dark:text-red-200 px-3 py-2.5 rounded-lg text-xs font-medium">
            ✕ {overlapError}
          </div>
        )}

        {list.length === 0 && <p className="text-xs text-muted-foreground">No activities yet.</p>}

        <SortableContext
          items={list.map((a) => `${date}|${a.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {list.map((a) => (
            <DraggableActivityItem
              key={a.id}
              activity={a}
              date={date}
              needsReview={reviewIds.has(a.id)}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))}
        </SortableContext>

        <Button type="button" variant="outline" className="dashed justify-center" onClick={() => onAddActivity(date)}>
          + Add activity
        </Button>
      </CardContent>
    </Card>
  );
}
