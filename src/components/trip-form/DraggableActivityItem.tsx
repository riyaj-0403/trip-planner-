import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import type { ActivityDraft } from "../../types/tripForm";

interface Props {
  activity: ActivityDraft;
  date: string;
  needsReview: boolean;
  onUpdate: (date: string, id: string, field: keyof ActivityDraft, value: string) => void;
  onRemove: (date: string, id: string) => void;
}

const DraggableActivityItem = memo(function DraggableActivityItem({
  activity,
  date,
  needsReview,
  onUpdate,
  onRemove,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `${date}|${activity.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn("p-2.5 flex flex-col gap-2 shadow-none", needsReview && "border-amber-400")}
    >
      {needsReview && (
        <span className="self-start rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-[11px] font-semibold px-2 py-0.5">
          ⚠ Timing needs review
        </span>
      )}
      <div className="flex gap-2">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="cursor-grab touch-none bg-none border-none text-sm text-muted-foreground px-1 shrink-0 hover:text-foreground"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <Input
          type="text"
          value={activity.name}
          onChange={(e) => onUpdate(date, activity.id, "name", e.target.value)}
          placeholder="e.g. Paragliding"
          className="flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(date, activity.id)}
          aria-label="Remove activity"
          className="px-2"
        >
          ✕
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="flex flex-col gap-0.5 text-xs font-semibold text-muted-foreground min-w-0">
          <span>Category</span>
          <select
            value={activity.category}
            onChange={(e) => onUpdate(date, activity.id, "category", e.target.value)}
            className="w-full px-2 py-1 border border-border rounded-md bg-card text-foreground text-xs"
          >
            <option value="">Select category</option>
            <option value="transport">Transport</option>
            <option value="food">Food</option>
            <option value="sightseeing">Sightseeing</option>
            <option value="adventure">Adventure</option>
            <option value="shopping">Shopping</option>
            <option value="stay">Stay</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="flex flex-col gap-0.5 text-xs font-semibold text-muted-foreground min-w-0">
          <span>Start</span>
          <Input
            type="time"
            value={activity.startTime}
            onChange={(e) => onUpdate(date, activity.id, "startTime", e.target.value)}
            className="text-xs px-1.5 py-1"
          />
        </div>
        <div className="flex flex-col gap-0.5 text-xs font-semibold text-muted-foreground min-w-0">
          <span>End</span>
          <Input
            type="time"
            value={activity.endTime}
            onChange={(e) => onUpdate(date, activity.id, "endTime", e.target.value)}
            className="text-xs px-1.5 py-1"
          />
        </div>
        <div className="flex flex-col gap-0.5 text-xs font-semibold text-muted-foreground min-w-0">
          <span>Cost</span>
          <Input
            type="number"
            min="0"
            value={activity.cost}
            onChange={(e) => onUpdate(date, activity.id, "cost", e.target.value)}
            placeholder="0"
            className="text-xs px-1.5 py-1"
          />
        </div>
      </div>
    </Card>
  );
});

export default DraggableActivityItem;
