import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getTripDetails } from "../api/index";
import CategoryDonutChart from "../components/CategoryDonutChart";
import { getCategoryColor, getCategoryLabel } from "../constants/categories";
import type { Trip, Destination, Activity } from "../types";
// import "./TripDetailPage.css";

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
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className={`stat-value${isNegative ? " stat-value--negative" : ""}`}>{value}</span>
    </div>
  );
}

function ActivityRow({ activity, currency }: { activity: Activity; currency: string }) {
  const color = getCategoryColor(activity.category);
  return (
    <div className="activity-row">
      <span className="activity-time">
        {activity.startTime && activity.endTime
          ? `${formatTime(activity.startTime)} – ${formatTime(activity.endTime)}`
          : activity.startTime
          ? formatTime(activity.startTime)
          : "—"}
      </span>
      <span className="activity-name">{activity.title}</span>
      <span
        className="activity-badge"
        style={{ background: color + "22", color }}
      >
        {getCategoryLabel(activity.category)}
      </span>
      <span className="activity-cost">
        {activity.cost > 0 ? `${currency} ${activity.cost.toLocaleString()}` : "—"}
      </span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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
    // TODO: navigate to edit form when implemented
    console.log("Edit trip", id);
  }

  function handleDelete() {
    if (!window.confirm("Delete this trip? This cannot be undone.")) return;
    // TODO: call deleteTrip(id) and navigate to "/"
    console.log("Delete trip", id);
  }

  // ── Render states ─────────────────────────────────────────────────────────

  if (status === "loading") {
    return (
      <div className="tdp-page">
        <div className="tdp-loading" role="status" aria-live="polite">
          Loading trip…
        </div>
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <div className="tdp-page">
        <div className="tdp-message">
          <h2>Trip not found</h2>
          <p>This trip doesn't exist or may have been deleted.</p>
          <Link to="/" className="tdp-back-link">← Back to trips</Link>
        </div>
      </div>
    );
  }

  if (status === "error" || !trip) {
    return (
      <div className="tdp-page">
        <div className="tdp-message">
          <h2>Something went wrong</h2>
          <p>We couldn't load this trip. Please try again.</p>
          <button
            className="tdp-retry-button"
            onClick={() => { setStatus("loading"); }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const currency = trip.currency;

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="tdp-page">
      {/* ── Header ── */}
      <header className="tdp-header">
        <Link to="/" className="tdp-back-link">← My Trips</Link>

        <div className="tdp-header-main">
          <div className="tdp-header-text">
            <h1 className="tdp-title">{trip.title}</h1>
            <p className="tdp-meta">
              <span>{formatDate(trip.startDate)} – {formatDate(trip.endDate)}</span>
              <span className="tdp-meta-sep">·</span>
              <span>{trip.travellers} traveller{trip.travellers !== 1 ? "s" : ""}</span>
            </p>
          </div>

          <div className="tdp-header-actions">
            <button className="tdp-edit-button" onClick={handleEdit}>Edit</button>
            <button className="tdp-delete-button" onClick={handleDelete}>Delete</button>
          </div>
        </div>
      </header>

      {/* ── Two-column body ── */}
      <div className="tdp-body">

        {/* LEFT: sticky sidebar */}
        <aside className="tdp-sidebar">
          {/* Budget stat cards */}
          <div className="tdp-stat-cards">
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
          <div className="tdp-chart-card">
            <h3 className="tdp-chart-title">Spending by Category</h3>
            <CategoryDonutChart
              data={spentByCategory}
              currency={currency}
              totalBudget={trip.totalBudget}
            />
          </div>
        </aside>

        {/* RIGHT: itinerary */}
        <main className="tdp-itinerary">
          <h2 className="tdp-itinerary-heading">Itinerary</h2>

          {itinerary.length === 0 ? (
            <p className="tdp-empty">No itinerary data yet.</p>
          ) : (
            itinerary.map(({ dest, days }, gi) => (
              <section key={dest?.id ?? `block-${gi}`} className="tdp-dest-section">
                {/* Destination heading */}
                <div className="tdp-dest-heading">
                  <h3 className="tdp-dest-name">
                    {dest ? `${dest.city}, ${dest.country}` : "Trip Days"}
                  </h3>
                  <span className="tdp-dest-days">
                    {days.length} day{days.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Day cards */}
                {days.map(({ date, dayNumber, activities: dayActs, subtotal }) => (
                  <div key={date} className="tdp-day-card">
                    <div className="tdp-day-header">
                      <div className="tdp-day-label">
                        <span className="tdp-day-number">Day {dayNumber}</span>
                        <span className="tdp-day-date">{formatDate(date)}</span>
                      </div>
                      {subtotal > 0 && (
                        <span className="tdp-day-subtotal">
                          {currency} {subtotal.toLocaleString()}
                        </span>
                      )}
                    </div>

                    {dayActs.length === 0 ? (
                      <p className="tdp-no-activities">No activities planned.</p>
                    ) : (
                      <div className="tdp-activity-list">
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
