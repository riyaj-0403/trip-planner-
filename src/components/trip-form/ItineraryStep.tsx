import { Fragment, useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import BudgetSummary from "./BudgetSummary";
import DayCard from "./DayCard";
import { newId } from "../../lib/newId";
import {
  OPTIMAL_HOURS_PER_DAY,
  TIMING_REVIEW_MESSAGE,
  calculateDayDuration,
  needsTimingReview,
  orderConflictIds,
  overlapIds,
} from "../../lib/tripTimings";
import type { ActivityDraft, DestinationRow } from "../../types/tripForm";

interface Props {
  days: string[];
  dayCount: number;
  destinations: DestinationRow[];
  effectiveDayCounts: number[];
  /** For each day (by position), the index of the destination it belongs to. */
  dayDestinationIndex: number[];
  activities: Record<string, ActivityDraft[]>;
  setActivities: Dispatch<SetStateAction<Record<string, ActivityDraft[]>>>;
  currency: string;
  totalBudget: string;
}

export default function ItineraryStep({
  days,
  dayCount,
  destinations,
  effectiveDayCounts,
  dayDestinationIndex,
  activities,
  setActivities,
  currency,
  totalBudget,
}: Props) {
  // Date of the day the activity being dragged came from (null when not dragging).
  const [dragSourceDate, setDragSourceDate] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // date -> index of the destination that day belongs to
  const dateToDestIndex = useMemo(() => {
    const map: Record<string, number> = {};
    days.forEach((date, i) => {
      map[date] = dayDestinationIndex[i];
    });
    return map;
  }, [days, dayDestinationIndex]);

  // ── Per-day warnings and "Timing needs review" flags ───────────────────────
  const { dayWarnings, overlapDays } = useMemo(() => {
    const warnings: Record<string, number> = {};
    const overlaps: Record<string, boolean> = {};
    Object.entries(activities).forEach(([date, list]) => {
      const dur = calculateDayDuration(list);
      if (dur > OPTIMAL_HOURS_PER_DAY) warnings[date] = dur - OPTIMAL_HOURS_PER_DAY;
      if (overlapIds(list).length > 0) overlaps[date] = true;
    });
    return { dayWarnings: warnings, overlapDays: overlaps };
  }, [activities]);

  // Worked out on every change, so the flag clears as soon as the times are fixed.
  const { reviewIds, orderDays } = useMemo(() => {
    const ids = new Set<string>();
    const order: Record<string, boolean> = {};
    Object.entries(activities).forEach(([date, list]) => {
      const orderIds = orderConflictIds(list);
      if (orderIds.length > 0) order[date] = true;
      orderIds.forEach((id) => ids.add(id));
      overlapIds(list).forEach((id) => ids.add(id));
    });
    return { reviewIds: ids, orderDays: order };
  }, [activities]);

  // ── Activity add / update / remove ─────────────────────────────────────────
  const addActivity = useCallback(
    (date: string) => {
      const blank: ActivityDraft = {
        id: newId(), name: "", category: "", startTime: "", endTime: "", cost: "",
      };
      setActivities((prev) => ({ ...prev, [date]: [...(prev[date] ?? []), blank] }));
    },
    [setActivities]
  );

  const updateActivity = useCallback(
    (date: string, id: string, field: keyof ActivityDraft, value: string) => {
      setActivities((prev) => ({
        ...prev,
        [date]: (prev[date] ?? []).map((a) => (a.id === id ? { ...a, [field]: value } : a)),
      }));
    },
    [setActivities]
  );

  const removeActivity = useCallback(
    (date: string, id: string) => {
      setActivities((prev) => ({
        ...prev,
        [date]: (prev[date] ?? []).filter((a) => a.id !== id),
      }));
    },
    [setActivities]
  );

  // ── Drag and drop ──────────────────────────────────────────────────────────
  function handleDragStart(event: DragStartEvent) {
    setDragSourceDate(String(event.active.id).split("|")[0]);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragSourceDate(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeStr = String(active.id);
    const overStr = String(over.id);

    const [sourceDate, sourceId] = activeStr.split("|");

    let targetDate: string;
    let targetId: string | null = null;

    if (overStr.startsWith("day:")) {
      targetDate = overStr.slice(4);
    } else {
      [targetDate, targetId] = overStr.split("|");
    }

    // Rule: activities can only move between days of the SAME destination.
    if (dateToDestIndex[sourceDate] !== dateToDestIndex[targetDate]) {
      toast.error("Can't rearrange activities from another destination.");
      return;
    }

    const sourceList = activities[sourceDate] ?? [];
    const targetList = activities[targetDate] ?? [];

    if (sourceDate === targetDate) {
      const fromIdx = sourceList.findIndex((a) => a.id === sourceId);
      const toIdx = targetId ? sourceList.findIndex((a) => a.id === targetId) : sourceList.length - 1;
      if (fromIdx === -1 || toIdx === -1) return;

      const reordered = arrayMove(sourceList, fromIdx, toIdx);
      setActivities((prev) => ({ ...prev, [sourceDate]: reordered }));

      // The order is kept as dropped; the affected activities get flagged.
      if (needsTimingReview(reordered)) toast.warning(TIMING_REVIEW_MESSAGE);
    } else {
      const moving = sourceList.find((a) => a.id === sourceId);
      if (!moving) return;

      const insertAt = targetId
        ? targetList.findIndex((a) => a.id === targetId)
        : targetList.length;
      const newTargetList = [...targetList];
      newTargetList.splice(insertAt === -1 ? newTargetList.length : insertAt, 0, moving);
      const newSourceList = sourceList.filter((a) => a.id !== sourceId);

      setActivities((prev) => ({
        ...prev,
        [sourceDate]: newSourceList,
        [targetDate]: newTargetList,
      }));

      // An overlap or wrong order on the new day is flagged, not blocked.
      if (needsTimingReview(newTargetList)) toast.warning(TIMING_REVIEW_MESSAGE);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="mb-2">
        <h2 className="text-xl text-foreground font-semibold mb-0">Plan your days</h2>
        <p className="text-sm text-muted-foreground">{dayCount} day{dayCount === 1 ? "" : "s"}. Add what you want to do on each day.</p>
      </div>

      <BudgetSummary activities={activities} currency={currency} totalBudget={totalBudget} />

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragSourceDate(null)}
      >
        <div className="flex flex-col gap-4">
          {days.map((date, i) => {
            const list = activities[date] ?? [];
            const destIndex = dayDestinationIndex[i];
            const showHeading = i === 0 || destIndex !== dayDestinationIndex[i - 1];
            // Dim days that belong to a different destination than the activity being dragged.
            const locked =
              dragSourceDate !== null && dateToDestIndex[dragSourceDate] !== destIndex;

            return (
              <Fragment key={date}>
                {showHeading && (
                  <div className="flex justify-between items-baseline py-1.5 pb-1.5 border-b-2 border-primary">
                    <h3 className="text-lg text-foreground font-semibold">{destinations[destIndex]?.name || `Destination ${destIndex + 1}`}</h3>
                    <span className="text-xs font-semibold text-primary">
                      {effectiveDayCounts[destIndex]} day{effectiveDayCounts[destIndex] === 1 ? "" : "s"}
                    </span>
                  </div>
                )}

                <DayCard
                  date={date}
                  dayNumber={i + 1}
                  list={list}
                  overlapError={overlapDays[date] ? "Activity times overlap." : undefined}
                  orderWarning={!!orderDays[date]}
                  exceedHours={dayWarnings[date]}
                  reviewIds={reviewIds}
                  locked={locked}
                  onAddActivity={addActivity}
                  onUpdate={updateActivity}
                  onRemove={removeActivity}
                />
              </Fragment>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
