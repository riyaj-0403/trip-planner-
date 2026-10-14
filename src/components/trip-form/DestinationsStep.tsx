import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { DestinationRow } from "../../types/tripForm";

interface Props {
  destinations: DestinationRow[];
  effectiveDayCounts: number[];
  namedDestinations: string[];
  dayCount: number;
  error?: string;
  onNameChange: (id: string, value: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onAddDay: (index: number) => void;
  onRemoveDay: (index: number) => void;
}

export default function DestinationsStep({
  destinations,
  effectiveDayCounts,
  namedDestinations,
  dayCount,
  error,
  onNameChange,
  onAdd,
  onRemove,
  onAddDay,
  onRemoveDay,
}: Props) {
  return (
    <div className="flex flex-col gap-5">
      <div className="mb-2">
        <h2 className="text-xl text-foreground font-semibold mb-0">Where are you going?</h2>
        <p className="text-sm text-muted-foreground">Add every stop on this trip, in the order you will visit.</p>
      </div>

      {destinations.map((dest, index) => (
        <div className="flex items-center gap-2.5" key={dest.id}>
          <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">{index + 1}</span>
          <Input
            type="text"
            value={dest.name}
            onChange={(e) => onNameChange(dest.id, e.target.value)}
            placeholder="e.g. Solang Valley"
            className="flex-1"
          />
          <div className="flex items-center gap-2 bg-muted px-2.5 py-1.5 rounded-lg shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onRemoveDay(index)}
              disabled={effectiveDayCounts[index] <= 1}
              className="w-6 h-6 p-0"
            >−</Button>
            <span className="text-xs font-semibold text-foreground min-w-11 text-center">
              {effectiveDayCounts[index] || 0} day{effectiveDayCounts[index] === 1 ? "" : "s"}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onAddDay(index)}
              className="w-6 h-6 p-0"
            >+</Button>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onRemove(dest.id)}
            aria-label={`Remove destination ${index + 1}`}
            className="px-2"
          >✕</Button>
        </div>
      ))}

      <Button type="button" variant="outline" className="dashed justify-center" onClick={onAdd}>
        + Add destination
      </Button>

      {error && <span className="text-sm text-destructive">{error}</span>}

      {effectiveDayCounts.length > 0 && namedDestinations.length > 0 && (
        <p className="m-0 px-3 py-2.5 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-xs text-blue-700 dark:text-blue-200">
          {dayCount} days split:{" "}
          {destinations
            .filter((d) => d.name.trim())
            .map((d, i) => `${d.name.trim()} (${effectiveDayCounts[i]})`)
            .join(", ")}
        </p>
      )}
    </div>
  );
}
