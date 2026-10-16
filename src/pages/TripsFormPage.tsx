import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { createTripDetails, getTripDetails, saveTripDetails } from "../api/index";
import {
  compareActivities,
  dayCountBetween,
  dayCountsFromDestinations,
  eachDay,
  splitDays,
} from "../lib/tripDates";
import { buildTripPayload, findInvalidTimes } from "../lib/buildTripPayload";
import { clearDraft, loadDraft } from "../lib/tripDraft";
import { newId } from "../lib/newId";
import { useDraftAutosave } from "../hooks/useDraftAutosave";
import type {
  ActivityDraft,
  DestinationRow,
  DraftShape,
  TripFormValues,
} from "../types/tripForm";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import StepIndicator from "../components/trip-form/StepIndicator";
import DraftBanner from "../components/trip-form/DraftBanner";
import TripLoadState from "../components/trip-form/TripLoadState";
import TripDetailsStep from "../components/trip-form/TripDetailsStep";
import DestinationsStep from "../components/trip-form/DestinationsStep";
import ItineraryStep from "../components/trip-form/ItineraryStep";

function TripsFormPageInner() {
  const navigate = useNavigate();
  const { id: tripId } = useParams<{ id: string }>();
  const isEditMode = !!tripId;

  // ── Loading & Error States ─────────────────────────────────────────────────
  const [loadingState, setLoadingState] = useState<"idle" | "loading" | "loaded" | "notfound" | "error">(
    isEditMode ? "loading" : "loaded"
  );
  const [loadError, setLoadError] = useState("");

  // ── Form State ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState<TripFormValues>({
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
  const baseUpdatedAtRef = useRef<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [currentStep, setStepState] = useState<1 | 2 | 3>(1);
  const setStep = (s: 1 | 2 | 3) => setStepState(s);

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

  useDraftAutosave({
    form,
    destinations,
    activities,
    adjustedDayCounts,
    tripId,
    enabled: loadingState === "loaded" && !pendingDraft,
    baseUpdatedAtRef,
  });

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

  // ── Validation & navigation ────────────────────────────────────────────────
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
    const { payload, outOfRange } = buildTripPayload({
      form,
      destinations,
      activities,
      days,
      effectiveDayCounts,
      dayDestinationIndex,
    });

    const invalid = findInvalidTimes(payload.activities);
    if (invalid.length > 0) {
      const names = invalid.slice(0, 3).map((a) => `"${a.title}"`).join(", ");
      const more = invalid.length > 3 ? ` and ${invalid.length - 3} more` : "";
      const msg = `Set a start time and an end time (end after start) for: ${names}${more}.`;
      setSubmitError(msg);
      toast.error(msg);
    return;
    }
    
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

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isEditMode && (loadingState === "loading" || loadingState === "notfound" || loadingState === "error")) {
    return <TripLoadState state={loadingState} message={loadError} onBack={() => navigate("/")} />;
  }

  return (
    <div className="max-w-2xl mx-auto py-4">
      <h1 className="mt-0 mb-6 text-3xl color-foreground font-semibold">
        {isEditMode ? "Edit trip" : "Create New Trip"}
      </h1>

      {pendingDraft && <DraftBanner onRestore={restoreDraft} onDiscard={discardDraft} />}

      <StepIndicator currentStep={currentStep} />

      <Card className="shadow-md">
        <CardContent className="p-7">
      <form
        className="flex flex-col gap-5"
        onSubmit={handleSubmit}
        noValidate
      >
        {currentStep === 1 && (
          <TripDetailsStep form={form} errors={errors} onChange={handleChange} />
        )}

        {currentStep === 2 && (
          <DestinationsStep
            destinations={destinations}
            effectiveDayCounts={effectiveDayCounts}
            namedDestinations={namedDestinations}
            dayCount={dayCount}
            error={errors.destinations}
            onNameChange={handleDestinationChange}
            onAdd={addDestination}
            onRemove={removeDestination}
            onAddDay={addDayToDestination}
            onRemoveDay={removeDayFromDestination}
          />
        )}

        {currentStep === 3 && (
          <ItineraryStep
            days={days}
            dayCount={dayCount}
            destinations={destinations}
            effectiveDayCounts={effectiveDayCounts}
            dayDestinationIndex={dayDestinationIndex}
            activities={activities}
            setActivities={setActivities}
            currency={form.currency}
            totalBudget={form.totalBudget}
          />
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
        </CardContent>
      </Card>
    </div>
  );
}

// Remount when the route changes (new <-> edit, or edit of a different trip) so no
// state leaks from one form to the next.
export default function TripsFormPage() {
  const { id } = useParams<{ id: string }>();
  return <TripsFormPageInner key={id ?? "new"} />;
}
