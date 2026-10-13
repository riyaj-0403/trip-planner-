import { Fragment, useState, useMemo, useCallback, useEffect, useRef, memo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createTripDetails, getTripDetails, saveTripDetails } from "../api/index";
import type { ActivityPayload, DestinationPayload, TripPayload } from "../lib/diffTrip";
import {
  compareActivities,
  dateRangesFromCounts,
  dayCountBetween,
  dayCountsFromDestinations,
  eachDay,
  splitDays,
} from "../lib/tripDates";
import type { Category } from "../types";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const STEPS = ["Trip details", "Destinations", "Itinerary"];
const OPTIMAL_HOURS_PER_DAY = 8;

interface ActivityDraft {
  id: string;
  name: string;
  category: string;
  startTime: string;
  endTime: string;
  cost: string;
}

interface DestinationRow {
  id: string;
  name: string;
}

type DraftShape = {
  form: {
    title: string; startDate: string; endDate: string;
    travellers: string; currency: string; totalBudget: string;
  };
  destinations: DestinationRow[];
  activities: Record<string, ActivityDraft[]>;
  adjustedDayCounts: number[];
  /** trip.updatedAt when the draft started (edit mode). A draft is stale if the trip changed since. */
  baseUpdatedAt: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

// ─── Spatial Arrow Navigation ─────────────────────────────────────────────────

function isTextLikeInput(el: Element): boolean {
  if (!(el instanceof HTMLInputElement)) return false;
  const type = el.type.toLowerCase();
  return type === "text" || type === "email" || type === "password" || type === "url" || type === "search";
}

function shouldConsumeArrow(el: Element, direction: string): boolean {
  if (!(el instanceof HTMLElement)) return false;

  // Text inputs: only consume arrow at caret boundaries (left at start, right at end)
  if (isTextLikeInput(el)) {
    const input = el as HTMLInputElement;
    if (direction === "ArrowLeft") return input.selectionStart === 0;
    if (direction === "ArrowRight") return input.selectionStart === input.value.length;
    return false;
  }

  // Date/time inputs: never consume (native spinners handle them)
  const tag = el.tagName.toLowerCase();
  const type = el.getAttribute("type")?.toLowerCase() ?? "";
  if (tag === "input" && (type === "date" || type === "time" || type === "datetime-local")) {
    return false;
  }

  // Number inputs: don't consume Up/Down (native spinners)
  if (tag === "input" && type === "number") {
    if (direction === "ArrowUp" || direction === "ArrowDown") return false;
  }

  // Default: consume
  return true;
}

function findSpatialTarget(
  current: HTMLElement,
  direction: string,
  stepContainer: HTMLElement | null
): HTMLElement | null {
  const focusables = (stepContainer ?? document).querySelectorAll(
    "input:not([type='button']):not([type='submit']):not([type='reset']), select, textarea, button"
  );
  if (focusables.length === 0) return null;

  const currentRect = current.getBoundingClientRect();
  const currentCenterX = currentRect.left + currentRect.width / 2;
  const currentCenterY = currentRect.top + currentRect.height / 2;

  const tolerance = 100; // pixels: candidates within this distance perpendicular to direction
  const candidates: { el: HTMLElement; distance: number }[] = [];

  for (const el of focusables) {
    if (el === current || !(el instanceof HTMLElement)) continue;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let isCandidate = false;
    let distance = Infinity;

    if (direction === "ArrowLeft") {
      if (centerX < currentCenterX) {
        const perpDist = Math.abs(centerY - currentCenterY);
        if (perpDist <= tolerance) {
          isCandidate = true;
          distance = currentCenterX - centerX;
        }
      }
    } else if (direction === "ArrowRight") {
      if (centerX > currentCenterX) {
        const perpDist = Math.abs(centerY - currentCenterY);
        if (perpDist <= tolerance) {
          isCandidate = true;
          distance = centerX - currentCenterX;
        }
      }
    } else if (direction === "ArrowUp") {
      if (centerY < currentCenterY) {
        const perpDist = Math.abs(centerX - currentCenterX);
        if (perpDist <= tolerance) {
          isCandidate = true;
          distance = currentCenterY - centerY;
        }
      }
    } else if (direction === "ArrowDown") {
      if (centerY > currentCenterY) {
        const perpDist = Math.abs(centerX - currentCenterX);
        if (perpDist <= tolerance) {
          isCandidate = true;
          distance = centerY - currentCenterY;
        }
      }
    }

    if (isCandidate) {
      candidates.push({ el: el as HTMLElement, distance });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0].el;
}

function handleSpatialArrowKey(
  e: React.KeyboardEvent<HTMLFormElement>,
  currentStep: number,
  formRef: React.RefObject<HTMLFormElement | null>
): void {
  const direction = e.key;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(direction)) return;

  const active = document.activeElement as HTMLElement;
  if (!active) return;

  // Only if inside form and focused on a form element
  if (!formRef.current?.contains(active)) return;

  // Check if this element should consume the arrow (e.g., caret at boundary)
  if (!shouldConsumeArrow(active, direction)) return;

  e.preventDefault();

  // Find the step container to scope the search
  const stepContainer = formRef.current?.querySelector(`div[data-step="${currentStep}"]`) as HTMLElement | null;

  const target = findSpatialTarget(active, direction, stepContainer);
  if (target) {
    target.focus();
  }
}

function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  if (!s1 || !e1 || !s2 || !e2) return false;
  const min = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  return !(min(e1) <= min(s2) || min(e2) <= min(s1));
}

function calculateDayDuration(list: ActivityDraft[]): number {
  return list.reduce((total, a) => {
    if (!a.startTime || !a.endTime) return total;
    const [h1, m1] = a.startTime.split(":").map(Number);
    const [h2, m2] = a.endTime.split(":").map(Number);
    return total + Math.max(0, (h2 * 60 + m2 - (h1 * 60 + m1)) / 60);
  }, 0);
}

// ─── Draft persistence with per-mode keys ─────────────────────────────────────

function getDraftKey(tripId?: string): string {
  return tripId ? `trip-draft-${tripId}` : "trip-draft-new";
}

function loadDraft(tripId?: string): DraftShape | null {
  try {
    const raw = localStorage.getItem(getDraftKey(tripId));
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<DraftShape>;
    if (!d.form || !Array.isArray(d.destinations) || !d.activities) return null;
    return {
      form: d.form,
      destinations: d.destinations,
      activities: d.activities,
      adjustedDayCounts: Array.isArray(d.adjustedDayCounts) ? d.adjustedDayCounts : [],
      baseUpdatedAt: d.baseUpdatedAt ?? null,
    };
  } catch {
    return null;
  }
}

function saveDraft(draft: DraftShape, tripId?: string) {
  try {
    localStorage.setItem(getDraftKey(tripId), JSON.stringify(draft));
  } catch { /* ignore */ }
}

function clearDraft(tripId?: string) {
  try {
    localStorage.removeItem(getDraftKey(tripId));
  } catch { /* ignore */ }
}

// ─── DraggableActivityItem ────────────────────────────────────────────────────

const DraggableActivityItem = memo(function DraggableActivityItem({
  activity,
  date,
  onUpdate,
  onRemove,
}: {
  activity: ActivityDraft;
  date: string;
  onUpdate: (date: string, id: string, field: keyof ActivityDraft, value: string) => void;
  onRemove: (date: string, id: string) => void;
}) {
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
    <div ref={setNodeRef} style={style} className="bg-card border border-border rounded-lg p-2.5 flex flex-col gap-2">
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
    </div>
  );
});

// ─── DayCard ──────────────────────────────────────────────────────────────────

function DayCard({
  date,
  dayNumber,
  list,
  overlapError,
  exceedHours,
  onAddActivity,
  onUpdate,
  onRemove,
}: {
  date: string;
  dayNumber: number;
  list: ActivityDraft[];
  overlapError: string | undefined;
  exceedHours: number | undefined;
  onAddActivity: (date: string) => void;
  onUpdate: (date: string, id: string, field: keyof ActivityDraft, value: string) => void;
  onRemove: (date: string, id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date}` });

  return (
    <div ref={setNodeRef} className={`bg-muted/50 border border-border rounded-xl px-4 py-4 flex flex-col gap-3 ${isOver ? "outline outline-dashed outline-muted-foreground/30" : ""}`}>
      <div className="flex justify-between items-baseline">
        <h3 className="text-base text-foreground font-semibold">Day {dayNumber}</h3>
        <span className="text-xs text-muted-foreground">{date}</span>
      </div>

      {exceedHours !== undefined && exceedHours > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 text-yellow-900 dark:text-yellow-200 px-3 py-2.5 rounded-lg text-xs font-medium">
          ⚠ {exceedHours.toFixed(1)} hrs exceeded the optimal time
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
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        ))}
      </SortableContext>

      <Button type="button" variant="outline" className="dashed justify-center" onClick={() => onAddActivity(date)}>
        + Add activity
      </Button>
    </div>
  );
}

// ─── TripsFormPage ────────────────────────────────────────────────────────────

function TripsFormPageInner() {
  const navigate = useNavigate();
  const { id: tripId } = useParams<{ id: string }>();
  const isEditMode = !!tripId;
  const formRef = useRef<HTMLFormElement>(null);

  // ── Loading & Error States ─────────────────────────────────────────────────
  const [loadingState, setLoadingState] = useState<"idle" | "loading" | "loaded" | "notfound" | "error">(
    isEditMode ? "loading" : "loaded"
  );
  const [loadError, setLoadError] = useState("");

  // ── Form State ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState<DraftShape["form"]>({
    title: "", startDate: "", endDate: "",
    travellers: "1", currency: "INR", totalBudget: "",
  });

  const [destinations, setDestinations] = useState<DestinationRow[]>([
    { id: newId(), name: "" },
  ]);

  const [activities, setActivities] = useState<Record<string, ActivityDraft[]>>({});

  const [adjustedDayCounts, setAdjustedDayCounts] = useState<number[]>([]);
  // An earlier unsaved draft waiting for the user to restore or discard it.
  const [pendingDraft, setPendingDraft] = useState<DraftShape | null>(null);
  // The state as first loaded: autosave only writes a draft once the user changed something.
  const baselineRef = useRef<string | null>(null);
  const baseUpdatedAtRef = useRef<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [overlapErrors, setOverlapErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [currentStep, setStepState] = useState<1 | 2 | 3>(1);
  const setStep = (s: 1 | 2 | 3) => setStepState(s);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Load saved trip (edit) and look for an earlier unsaved draft ────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!isEditMode) {
        const draft = loadDraft();
        if (draft) setPendingDraft(draft);
        return;
      }

      try {
        setLoadingState("loading");
        const data = await getTripDetails(tripId!);
        if (cancelled) return;

        // Destinations keep their saved order. Saved arrival/departure dates give
        // the days per destination; if they are missing or do not line up, the
        // form falls back to an even split (same as the detail page).
        const dests: DestinationRow[] = data.destinations.map((d) => ({
          id: d.id,
          name: d.country ? `${d.city}, ${d.country}` : d.city,
        }));
        const savedCounts =
          dayCountsFromDestinations(data.destinations, data.trip.startDate, data.trip.endDate) ?? [];

        // Same ordering as the detail page: by day, then start time, then saved order.
        const actsByDate: Record<string, ActivityDraft[]> = {};
        [...data.activities]
          .sort((a, b) => a.date.localeCompare(b.date) || compareActivities(a, b))
          .forEach((a) => {
            (actsByDate[a.date] ??= []).push({
              id: a.id,
              name: a.title,
              category: a.category,
              startTime: a.startTime,
              endTime: a.endTime,
              cost: String(a.cost),
            });
          });

        setForm({
          title: data.trip.title,
          startDate: data.trip.startDate,
          endDate: data.trip.endDate,
          travellers: String(data.trip.travellers),
          currency: data.trip.currency,
          totalBudget: String(data.trip.totalBudget),
        });
        setDestinations(dests.length > 0 ? dests : [{ id: newId(), name: "" }]);
        setActivities(actsByDate);
        setAdjustedDayCounts(dests.length > 0 ? savedCounts : []);
        baseUpdatedAtRef.current = data.trip.updatedAt;

        // A draft only counts if the trip has not changed since it was started.
        const draft = loadDraft(tripId);
        if (draft) {
          if (draft.baseUpdatedAt === data.trip.updatedAt) setPendingDraft(draft);
          else clearDraft(tripId);
        }
        setLoadingState("loaded");
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("not found")) {
          setLoadingState("notfound");
        } else {
          setLoadError(msg);
          setLoadingState("error");
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, tripId]);

  function restoreDraft() {
    if (!pendingDraft) return;
    setForm(pendingDraft.form);
    setDestinations(pendingDraft.destinations);
    setActivities(pendingDraft.activities);
    setAdjustedDayCounts(pendingDraft.adjustedDayCounts);
    setPendingDraft(null);
  }

  function discardDraft() {
    clearDraft(tripId);
    setPendingDraft(null);
  }

  // ── Draft autosave (only once the user has changed something) ──────────────
  useEffect(() => {
    if (loadingState !== "loaded" || pendingDraft) return;
    const snapshot = JSON.stringify({ form, destinations, activities, adjustedDayCounts });
    if (baselineRef.current === null) {
      baselineRef.current = snapshot; // first settled state = "nothing changed yet"
      return;
    }
    if (snapshot === baselineRef.current) return;
    const t = setTimeout(() => {
      saveDraft(
        { form, destinations, activities, adjustedDayCounts, baseUpdatedAt: baseUpdatedAtRef.current },
        tripId
      );
    }, 300);
    return () => clearTimeout(t);
  }, [form, destinations, activities, adjustedDayCounts, tripId, loadingState, pendingDraft]);

  // ── Derived values ────────────────────────────────────────────────────────
  const { dayCount, days } = useMemo(
    () => ({
      dayCount: dayCountBetween(form.startDate, form.endDate),
      days: eachDay(form.startDate, form.endDate),
    }),
    [form.startDate, form.endDate]
  );

  const namedDestinations = useMemo(
    () => destinations.map((d) => d.name.trim()).filter(Boolean),
    [destinations]
  );

  const effectiveDayCounts = useMemo(() => {
    if (destinations.length === 0 || dayCount === 0) return [];
    return adjustedDayCounts.length === destinations.length
      ? adjustedDayCounts
      : splitDays(dayCount, destinations.length);
  }, [adjustedDayCounts, destinations.length, dayCount]);

  const dayDestinationIndex = useMemo(
    () => effectiveDayCounts.flatMap((n, i) => Array.from({ length: n }, () => i)),
    [effectiveDayCounts]
  );

  const { totalSpent, spentByCategory, remainingBudget } = useMemo(() => {
    const flat = Object.values(activities).flat();
    const spent = flat.reduce((s, a) => s + Number(a.cost || 0), 0);
    const byCategory: Record<string, number> = {};
    flat.forEach((a) => {
      if (a.category) byCategory[a.category] = (byCategory[a.category] || 0) + Number(a.cost || 0);
    });
    return {
      totalSpent: spent,
      spentByCategory: byCategory,
      remainingBudget: Number(form.totalBudget || 0) - spent,
    };
  }, [activities, form.totalBudget]);

  const { dayWarnings, overlapDays } = useMemo(() => {
    const warnings: Record<string, number> = {};
    const overlaps: Record<string, boolean> = {};
    Object.entries(activities).forEach(([date, list]) => {
      const dur = calculateDayDuration(list);
      if (dur > OPTIMAL_HOURS_PER_DAY) warnings[date] = dur - OPTIMAL_HOURS_PER_DAY;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          if (timesOverlap(list[i].startTime, list[i].endTime, list[j].startTime, list[j].endTime)) {
            overlaps[date] = true;
          }
        }
      }
    });
    return { dayWarnings: warnings, overlapDays: overlaps };
  }, [activities]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setForm((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  const handleDestinationChange = useCallback((id: string, value: string) => {
    setDestinations((prev) => prev.map((d) => (d.id === id ? { ...d, name: value } : d)));
  }, []);

  const addDestination = useCallback(() => {
    setDestinations((prev) => [...prev, { id: newId(), name: "" }]);
  }, []);

  const removeDestination = useCallback((id: string) => {
    setDestinations((prev) => prev.filter((d) => d.id !== id));
  }, []);

  function addDayToDestination(index: number) {
    const total = effectiveDayCounts.reduce((a, b) => a + b, 0);
    if (total < dayCount) {
      const next = [...effectiveDayCounts];
      next[index]++;
      setAdjustedDayCounts(next);
      setErrors((prev) => ({ ...prev, destinations: "" }));
    }
  }

  function removeDayFromDestination(index: number) {
    if (effectiveDayCounts[index] > 1) {
      const next = [...effectiveDayCounts];
      next[index]--;
      setAdjustedDayCounts(next);
      setErrors((prev) => ({ ...prev, destinations: "" }));
    }
  }

  const addActivity = useCallback((date: string) => {
    const blank: ActivityDraft = {
      id: newId(), name: "", category: "", startTime: "", endTime: "", cost: "",
    };
    setActivities((prev) => ({ ...prev, [date]: [...(prev[date] ?? []), blank] }));
  }, []);

  const updateActivity = useCallback(
    (date: string, id: string, field: keyof ActivityDraft, value: string) => {
      setActivities((prev) => ({
        ...prev,
        [date]: (prev[date] ?? []).map((a) => (a.id === id ? { ...a, [field]: value } : a)),
      }));
    },
    []
  );

  const removeActivity = useCallback((date: string, id: string) => {
    setActivities((prev) => ({
      ...prev,
      [date]: (prev[date] ?? []).filter((a) => a.id !== id),
    }));
  }, []);

  function handleDragEnd(event: DragEndEvent) {
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

    const sourceList = activities[sourceDate] ?? [];
    const targetList = activities[targetDate] ?? [];

    if (sourceDate === targetDate) {
      const fromIdx = sourceList.findIndex((a) => a.id === sourceId);
      const toIdx = targetId ? sourceList.findIndex((a) => a.id === targetId) : sourceList.length - 1;
      if (fromIdx === -1 || toIdx === -1) return;

      const reordered = arrayMove(sourceList, fromIdx, toIdx);
      setActivities((prev) => ({ ...prev, [sourceDate]: reordered }));
    } else {
      const moving = sourceList.find((a) => a.id === sourceId);
      if (!moving) return;

      const wouldOverlap = targetList.some((a) =>
        timesOverlap(moving.startTime, moving.endTime, a.startTime, a.endTime)
      );

      if (wouldOverlap) {
        const msg = "Can't move here: the time overlaps another activity.";
        setOverlapErrors((prev) => ({ ...prev, [targetDate]: msg }));
        setTimeout(() => {
          setOverlapErrors((prev) => {
            const next = { ...prev };
            delete next[targetDate];
            return next;
          });
        }, 3000);
        return;
      }

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
    }
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.title.trim()) next.title = "Trip title is required.";
    if (!(Number(form.travellers) >= 1)) next.travellers = "At least 1 traveller.";
    if (!form.startDate) next.startDate = "Start date is required.";
    if (!form.endDate) next.endDate = "End date is required.";
    if (form.startDate && form.endDate && form.startDate > form.endDate)
      next.endDate = "Start date can't be after the end date.";
    if (!(Number(form.totalBudget) > 0))
      next.totalBudget = "Budget must be greater than 0.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goBack() {
    if (currentStep === 1) {
      if (isEditMode) navigate(`/trips/${tripId}`);
      else navigate("/");
    } else {
      setStep((currentStep - 1) as 1 | 2 | 3);
    }
  }

  /** Everything the API needs, built from what the form already knows. */
  function buildPayload(): { payload: TripPayload; outOfRange: number } {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (currentStep === 1) {
      if (validate()) setStep(2);
      return;
    }

    if (currentStep === 2) {
      if (destinations.some((d) => !d.name.trim())) {
        setErrors({ destinations: "Fill in every destination, or remove the empty ones." });
        return;
      }
      if (namedDestinations.length === 0) {
        setErrors({ destinations: "Add at least one destination." });
        return;
      }
      if (namedDestinations.length > dayCount) {
        setErrors({
          destinations: `You have ${namedDestinations.length} destinations but only ${dayCount} days.`,
        });
        return;
      }
      const totalAdjusted = effectiveDayCounts.reduce((a, b) => a + b, 0);
      if (totalAdjusted !== dayCount) {
        setErrors({
          destinations: `Total days must equal ${dayCount}. Currently: ${totalAdjusted}.`,
        });
        return;
      }
      setErrors({});
      setStep(3);
      return;
    }

    // Step 3 – save
    const { payload, outOfRange } = buildPayload();
    if (
      outOfRange > 0 &&
      !window.confirm(
        `${outOfRange} planned ${outOfRange === 1 ? "activity falls" : "activities fall"} outside the new trip dates and will be removed. Continue?`
      )
    ) {
      return;
    }

    setSaving(true);
    setSubmitError("");
    try {
      if (isEditMode) {
        await saveTripDetails(tripId!, payload);
        clearDraft(tripId);
        toast.success("Trip updated!");
        navigate(`/trips/${tripId}`);
      } else {
        const created = await createTripDetails(payload);
        clearDraft();
        toast.success("Trip created!");
        navigate(`/trips/${created.id}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save trip.";
      setSubmitError(msg);
    } finally {
      setSaving(false);
    }
  }

  // ── Loading / Error States ─────────────────────────────────────────────────

  if (isEditMode && loadingState === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin size-5" />
          <span>Loading trip...</span>
        </div>
      </div>
    );
  }

  if (isEditMode && loadingState === "notfound") {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <div className="flex gap-3 items-start p-4 rounded-lg border border-destructive/30 bg-destructive/10">
          <AlertCircle className="size-5 text-destructive mt-0.5 shrink-0" />
          <div className="flex flex-col gap-2">
            <h2 className="font-semibold text-destructive">Trip not found</h2>
            <p className="text-sm text-muted-foreground">This trip doesn't exist or may have been deleted.</p>
            <Button onClick={() => navigate("/")} className="w-fit">
              Back to trips
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isEditMode && loadingState === "error") {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <div className="flex gap-3 items-start p-4 rounded-lg border border-destructive/30 bg-destructive/10">
          <AlertCircle className="size-5 text-destructive mt-0.5 shrink-0" />
          <div className="flex flex-col gap-2">
            <h2 className="font-semibold text-destructive">Error loading trip</h2>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button onClick={() => navigate("/")} className="w-fit">
              Back to trips
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Render ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto py-4">
      <h1 className="mt-0 mb-6 text-3xl color-foreground font-semibold">
          {isEditMode ? "Edit trip" : "Create New Trip"}
        </h1>

        {pendingDraft && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted px-4 py-3 text-sm">
            <span>You have unsaved changes from earlier. Restore them?</span>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={restoreDraft}>Restore</Button>
              <Button type="button" size="sm" variant="outline" onClick={discardDraft}>Discard</Button>
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-between mb-5">
          {STEPS.map((label, i) => {
            const number = i + 1;
            const status = number === currentStep ? "active" : number < currentStep ? "done" : "";
            return (
              <div className={`flex items-center gap-2 text-muted-foreground text-xs font-semibold flex-1 ${status === "active" ? "text-foreground" : ""}`} key={label}>
                <span className={`w-6 h-6 rounded-full border border-border bg-card flex items-center justify-center text-xs shrink-0 ${status === "active" ? "bg-primary border-primary text-primary-foreground" : status === "done" ? "border-primary text-primary" : ""}`}>
                  {number < currentStep ? "✓" : number}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </div>
            );
          })}
        </div>

        <form 
          ref={formRef}
          className="bg-card border border-border rounded-lg shadow-md p-7 flex flex-col gap-5" 
          onSubmit={handleSubmit}
          onKeyDown={(e) => handleSpatialArrowKey(e, currentStep, formRef)}
          noValidate
        >

          {currentStep === 1 && (
            <div data-step="1" className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">Trip title</Label>
                <Input
                  id="title" name="title" type="text"
                  value={form.title} onChange={handleChange}
                  placeholder="e.g. Manali Adventure"
                />
                {errors.title && <span className="text-sm text-destructive">{errors.title}</span>}
              </div>

              <div className="flex gap-4 flex-col md:flex-row">
                <div className="flex flex-col gap-1.5 flex-1">
                  <Label htmlFor="startDate">Start date</Label>
                  <Input id="startDate" name="startDate" type="date" value={form.startDate} onChange={handleChange} />
                  {errors.startDate && <span className="text-sm text-destructive">{errors.startDate}</span>}
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <Label htmlFor="endDate">End date</Label>
                  <Input id="endDate" name="endDate" type="date" value={form.endDate} onChange={handleChange} />
                  {errors.endDate && <span className="text-sm text-destructive">{errors.endDate}</span>}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="travellers">Travellers</Label>
                <Input id="travellers" name="travellers" type="number" min="1" value={form.travellers} onChange={handleChange} />
                {errors.travellers && <span className="text-sm text-destructive">{errors.travellers}</span>}
              </div>

              <div className="flex gap-4 flex-col md:flex-row">
                <div className="flex flex-col gap-1.5 flex-1">
                  <Label htmlFor="currency">Currency</Label>
                  <select id="currency" name="currency" value={form.currency} onChange={handleChange} className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground">
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <Label htmlFor="totalBudget">Total budget</Label>
                  <Input
                    id="totalBudget" name="totalBudget" type="number" min="0"
                    value={form.totalBudget} onChange={handleChange} placeholder="e.g. 50000"
                  />
                  {errors.totalBudget && <span className="text-sm text-destructive">{errors.totalBudget}</span>}
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div data-step="2" className="flex flex-col gap-5">
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
                    onChange={(e) => handleDestinationChange(dest.id, e.target.value)}
                    placeholder="e.g. Solang Valley"
                    className="flex-1"
                  />
                  <div className="flex items-center gap-2 bg-muted px-2.5 py-1.5 rounded-lg shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => removeDayFromDestination(index)}
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
                      onClick={() => addDayToDestination(index)}
                      className="w-6 h-6 p-0"
                    >+</Button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeDestination(dest.id)}
                    aria-label={`Remove destination ${index + 1}`}
                    className="px-2"
                  >✕</Button>
                </div>
              ))}

              <Button type="button" variant="outline" className="dashed justify-center" onClick={addDestination}>
                + Add destination
              </Button>

              {errors.destinations && <span className="text-sm text-destructive">{errors.destinations}</span>}

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
          )}

          {currentStep === 3 && (
            <div data-step="3" className="flex flex-col gap-5">
              <div className="mb-2">
                <h2 className="text-xl text-foreground font-semibold mb-0">Plan your days</h2>
                <p className="text-sm text-muted-foreground">{dayCount} day{dayCount === 1 ? "" : "s"}. Add what you want to do on each day.</p>
              </div>

              <div className={`px-3.5 py-3 flex flex-col gap-2.5 rounded-lg ${remainingBudget >= 0 ? "bg-green-50/50 dark:bg-green-950/20 border border-green-200 dark:border-green-900" : "bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900"}`}>
                <div className="flex justify-between text-xs font-semibold text-foreground">
                  <span>Total Spent:</span>
                  <span className="text-foreground font-bold">{form.currency} {totalSpent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-foreground">
                  <span>Budget:</span>
                  <span className="text-foreground font-bold">{form.currency} {Number(form.totalBudget).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-foreground">
                  <span>Remaining:</span>
                  <span className={`text-foreground font-bold ${remainingBudget < 0 ? "text-destructive" : ""}`}>
                    {form.currency} {remainingBudget.toLocaleString()}
                  </span>
                </div>
                {Object.entries(spentByCategory).length > 0 && (
                  <div className={`pt-2 border-t flex flex-col gap-1.5 ${remainingBudget >= 0 ? "border-green-200/50 dark:border-green-900/30" : "border-red-200/50 dark:border-red-900/30"}`}>
                    <span className="text-xs font-semibold text-muted-foreground uppercase">By Category:</span>
                    {Object.entries(spentByCategory).map(([cat, amount]) => (
                      <div key={cat} className="flex justify-between text-xs text-muted-foreground">
                        <span className="capitalize">{cat}</span>
                        <span className="font-medium text-foreground">{form.currency} {amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="flex flex-col gap-4">
                  {days.map((date, i) => {
                    const list = activities[date] ?? [];
                    const destIndex = dayDestinationIndex[i];
                    const showHeading = i === 0 || destIndex !== dayDestinationIndex[i - 1];

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
                          overlapError={
                            overlapErrors[date] ||
                            (overlapDays[date] ? "Activity times overlap." : undefined)
                          }
                          exceedHours={dayWarnings[date]}
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
          )}

          {submitError && <span className="text-sm text-destructive">{submitError}</span>}

          <div className="flex justify-end gap-3 mt-1">
            <Button type="button" variant="outline" onClick={goBack} disabled={saving}>
              {currentStep === 1 ? "Cancel" : "← Back"}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : currentStep === 3 ? (isEditMode ? "Save changes" : "Save Trip") : "Next →"}
            </Button>
          </div>
        </form>
    </div>
  );
}

// Remount when the route changes (new <-> edit, or edit of a different trip) so no
// state leaks from one form to the next.
export default function TripsFormPage() {
  const { id } = useParams<{ id: string }>();
  return <TripsFormPageInner key={id ?? "new"} />;
}