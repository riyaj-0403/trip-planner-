# Trip Planner

A React + TypeScript trip planning app. Create trips, add destinations, build a day-by-day itinerary, drag-and-drop activities, and track spending — all in the browser. It will be further connected to the backend made by my teammate. 

---

## Main workflow

The app has three pages connected by a single flow:

**Trip list → Create/Edit form → Trip detail**

1. The **list page** shows all trips as cards with a budget progress bar. You search by name or filter by date range, then click a card to view it or hit "New Trip" to start the form.

2. The **form** is three steps. Step 1 takes the trip title, dates, travellers, currency and budget. Step 2 lets you add destinations in visit order and distribute the total days across them with +/− buttons. Step 3 shows one day card per day where you add activities, time, and cost — dragging them between days or reordering within a day. A live budget summary updates as you type. The form autosaves to `localStorage` every 300 ms so a page refresh never loses work.

3. The **detail page** shows the full itinerary grouped by destination, a sticky sidebar with budget stat cards, and a spending donut chart broken down by category. From here you can either edit or delete the trip.

The same form component handles both create and edit — edit mode is detected via the `:id` URL param. The data layer (`src/api/index.ts`) simulates a real API with a 400 ms delay and persists to `localStorage`, so the function signatures are ready to be swapped for real HTTP calls.

---

## Decision log

**Reuse the form for edit mode instead of a second component**
Adding a second form would mean keeping two copies of the same logic in sync forever. Instead, the form checks `useParams()` for an `id` — if present it loads the trip, prefills all state, and switches labels and save behaviour. The component is keyed on the param so navigating between create and edit fully remounts it with no state leakage.

**Separate draft keys for create vs edit**
A single `trip-draft` key would let an abandoned edit session overwrite a new-trip draft or vice versa. Using `trip-draft-new` for create and `trip-draft-<id>` for each edit means the two can coexist safely and the restore prompt only appears for the right mode.

**Timestamp-based draft staleness check**
When opening an edit, the draft is only offered for restore if its `baseUpdatedAt` matches the trip's current `updatedAt`. If the trip was saved elsewhere since the draft was started, the draft is silently discarded rather than letting stale data overwrite fresh data.

**Diff-based save (`computeChanges`)**
Sending the entire trip payload on every save is wasteful and fragile with a relational backend (foreign key ordering, unnecessary writes). `computeChanges()` in `lib/diffTrip.ts` compares the original loaded data against the form submission and produces a `Changes` object with `toCreate`, `toUpdate`, and `toDelete` lists for destinations and activities. Only what changed goes to the API. Activities belonging to a deleted destination are excluded from `toDelete` because the cascade handles them.

**UTC-only date arithmetic**
Mixing `new Date(isoString)` (local time) with `.toISOString()` (UTC) shifts dates by one day in timezones ahead of UTC — IST (UTC+5:30). All date helpers in `lib/tripDates.ts` use `Date.UTC()` for parsing and `toISOString().slice(0, 10)` for formatting, so the result is timezone-invariant.

**Responsive layouts: mobile-first, not desktop-shrunk**
All grids start at 1 column and expand — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` for trip cards, `flex-col sm:flex-row` for stat cards and headers. The activity rows in the detail page use `flex-col sm:grid sm:grid-cols-4` so the four fields (time, name, category, cost) stack on small screens and sit in one row on larger ones. The donut chart legend does the same.

**Used tweakcn theme** The entire project uses the same theme which was taken from tweakcn. It is a schadcm based ui theme, which follows accents of green and white color. 
