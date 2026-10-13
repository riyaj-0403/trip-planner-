import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getTripDetails } from "../api/index";
import { Button } from "../components/ui/button";
import CategoryDonutChart from "../components/CategoryDonutChart";
import { getCategoryColor, getCategoryLabel } from "../constants/categories";
import type { Trip, Destination, Activity } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatTime(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Same splitDays logic as the form: distribute days evenly across destinations. */
function splitDays(total: number, count: number): number[] {
  if (!count || !total) return [];
  const base = Math.floor(total / count);
  const extra = total % count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Given a start-date string and an offset, return the ISO date for that day. */
function addDays(startIso: string, offset: number): string {
  const d = new Date(startIso + "T00:00:00");
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, isNegative,
}: { label: string; value: string; isNegative?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-lg px-4 py-3.5 flex justify-between items-center shadow-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={`text-base font-bold ${isNegative ? "text-destructive" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

function ActivityRow({ activity, currency }: { activity: Activity; currency: string }) {
  const color = getCategoryColor(activity.category);
  return (
    <div className="grid grid-cols-4 items-center gap-2.5 px-2.5 py-2 bg-muted rounded-lg text-xs">
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {activity.startTime && activity.endTime
          ? `${formatTime(activity.startTime)} – ${formatTime(activity.endTime)}`
          : activity.startTime
          ? formatTime(activity.startTime)
          : "—"}
      </span>
      <span className="font-medium text-foreground min-w-0 truncate">{activity.title}</span>
      <span
        className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0"
        style={{background: color + "22", color}}
      >
        {getCategoryLabel(activity.category)}
      </span>
      <span className="text-xs font-semibold text-foreground whitespace-nowrap text-right">
        {activity.cost > 0 ? `${currency} ${activity.cost.toLocaleString()}` : "—"}
      </span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TripDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "notfound" | "ok">("loading");

  // Fetch on mount / id change with cancelled-flag guard
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    async function load() {
      try {
        const result = await getTripDetails(id ?? "");
        if (cancelled) return;
        setTrip(result.trip);
        setDestinations(result.destinations);
        setActivities(result.activities);
        setStatus("ok");
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "";
        setStatus(msg.toLowerCase().includes("not found") ? "notfound" : "error");
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  // ── Derived budget data ───────────────────────────────────────────────────

  const { spentByCategory, totalSpent, remaining } = useMemo(() => {
    const byCategory: Record<string, number> = {};
    for (const a of activities) {
      const key = a.category || "uncategorized";
      byCategory[key] = (byCategory[key] ?? 0) + a.cost;
    }
    const spent = Object.values(byCategory).reduce((s, v) => s + v, 0);
    return {
      spentByCategory: byCategory,
      totalSpent: spent,
      remaining: (trip?.totalBudget ?? 0) - spent,
    };
  }, [activities, trip]);

  // ── Itinerary structure ──────────────────────────────────────────────────

  /** Build [ { destination, days: [ { date, dayNumber, activities[] } ] } ] */
  const itinerary = useMemo(() => {
    if (!trip) return [];

    // Total trip days
    const totalDays = Math.max(
      0,
      Math.round(
        (new Date(trip.endDate + "T00:00:00").getTime() -
          new Date(trip.startDate + "T00:00:00").getTime()) /
          86400000
      ) + 1
    );

    // Assign day counts to each destination (same splitDays logic as the form)
    const dayCounts =
      destinations.length > 0
        ? splitDays(totalDays, destinations.length)
        : [totalDays]; // no destinations – treat the whole trip as one block

    // Map activities by date for quick lookup
    const activitiesByDate: Record<string, Activity[]> = {};
    for (const a of activities) {
      activitiesByDate[a.date] = activitiesByDate[a.date] ?? [];
      activitiesByDate[a.date].push(a);
    }
    // Sort each day's activities by startTime ascending
    for (const list of Object.values(activitiesByDate)) {
      list.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    }

    let dayOffset = 0;
    return dayCounts.map((count, di) => {
      const dest = destinations[di];
      const days = Array.from({ length: count }, (_, k) => {
        const date = addDays(trip.startDate, dayOffset + k);
        const list = activitiesByDate[date] ?? [];
        const subtotal = list.reduce((s, a) => s + a.cost, 0);
        return { date, dayNumber: dayOffset + k + 1, activities: list, subtotal };
      });
      dayOffset += count;
      return { dest, days };
    });
  }, [trip, destinations, activities]);

  // ── TODO handlers ─────────────────────────────────────────────────────────

  function handleEdit() {
    navigate(`/trips/${id}/edit`);
  }

  function handleDelete() {
    if (!window.confirm("Delete this trip? This cannot be undone.")) return;
    // TODO: call deleteTrip(id) and navigate to "/"
    console.log("Delete trip", id);
  }

  // ── Render states ─────────────────────────────────────────────────────────

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-3 text-center text-muted-foreground text-base" role="status" aria-live="polite">
        Loading trip…
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-3 text-center">
        <h2 className="m-0 text-2xl text-foreground font-semibold">Trip not found</h2>
        <p className="m-0 text-sm text-muted-foreground">This trip doesn't exist or may have been deleted.</p>
        <Link to="/" className="inline-block text-xs font-semibold text-primary hover:underline">← Back to trips</Link>
      </div>
    );
  }

  if (status === "error" || !trip) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-3 text-center">
        <h2 className="m-0 text-2xl text-foreground font-semibold">Something went wrong</h2>
        <p className="m-0 text-sm text-muted-foreground">We couldn't load this trip. Please try again.</p>
        <Button variant="outline" onClick={() => { setStatus("loading"); }}>Retry</Button>
      </div>
    );
  }

  const currency = trip.currency;

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <header className="space-y-3">
        <Link to="/" className="inline-block text-xs font-semibold text-primary hover:underline">← My Trips</Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl text-foreground font-semibold m-0 mb-1.5">{trip.title}</h1>
            <p className="m-0 text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
              <span>{formatDate(trip.startDate)} – {formatDate(trip.endDate)}</span>
              <span className="text-border">·</span>
              <span>{trip.travellers} traveller{trip.travellers !== 1 ? "s" : ""}</span>
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleEdit}>Edit</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </header>

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">

        {/* LEFT: sticky sidebar */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          {/* Budget stat cards */}
          <div className="flex flex-col gap-2.5">
            <StatCard
              label="Total Budget"
              value={`${currency} ${trip.totalBudget.toLocaleString()}`}
            />
            <StatCard
              label="Spent"
              value={`${currency} ${totalSpent.toLocaleString()}`}
            />
            <StatCard
              label="Remaining"
              value={`${currency} ${remaining.toLocaleString()}`}
              isNegative={remaining < 0}
            />
          </div>

          {/* Donut chart + legend */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="m-0 mb-4 text-sm font-bold text-foreground uppercase tracking-wider">Spending by Category</h3>
            <CategoryDonutChart
              data={spentByCategory}
              currency={currency}
              totalBudget={trip.totalBudget}
            />
          </div>
        </aside>

        {/* RIGHT: itinerary */}
        <main className="flex flex-col gap-6">
          <h2 className="m-0 text-xl text-foreground font-semibold">Itinerary</h2>

          {itinerary.length === 0 ? (
            <p className="text-muted-foreground text-sm m-0">No itinerary data yet.</p>
          ) : (
            itinerary.map(({ dest, days }, gi) => (
              <section key={dest?.id ?? `block-${gi}`} className="flex flex-col gap-3">
                <div className="flex justify-between items-baseline pb-1.5 border-b-2 border-primary">
                  <h3 className="m-0 text-lg text-foreground font-semibold">
                    {dest ? `${dest.city}, ${dest.country}` : "Trip Days"}
                  </h3>
                  <span className="text-xs font-semibold text-primary">
                    {days.length} day{days.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {days.map(({ date, dayNumber, activities: dayActs, subtotal }) => (
                  <div key={date} className="bg-card border border-border rounded-2xl px-4 py-4 flex flex-col gap-3 shadow-sm">
                    <div className="flex justify-between items-baseline">
                      <div className="flex items-baseline gap-2.5">
                        <span className="text-base font-bold text-foreground">Day {dayNumber}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(date)}</span>
                      </div>
                      {subtotal > 0 && (
                        <span className="text-xs font-semibold text-foreground">
                          {currency} {subtotal.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {dayActs.length === 0 ? (
                      <p className="m-0 text-xs text-muted-foreground">No activities planned.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {dayActs.map((a) => (
                          <ActivityRow key={a.id} activity={a} currency={currency} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </section>
            ))
          )}
        </main>
      </div>
    </div>
  );
}
