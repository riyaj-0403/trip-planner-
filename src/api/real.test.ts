import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── How these tests work ─────────────────────────────────────────────────────
// real.ts talks to the backend with fetch(). In tests there is no backend, so we
// replace fetch with a fake that (1) records every request the code makes and
// (2) answers with whatever JSON we choose. Then we check two things:
//   - what the code SENT  (method, address, body)   -> the contract with the backend
//   - what the code RETURNED to the pages           -> the conversion to frontend types

type Call = { method: string; url: string; body: any };
let calls: Call[];

/** Install a fake fetch. `handler` gets the request and returns the reply. */
function fakeBackend(handler: (c: Call) => { status?: number; json?: unknown } | undefined) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const call: Call = {
        method: init?.method ?? "GET",
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      };
      calls.push(call);
      const reply = handler(call) ?? { status: 200, json: {} };
      const status = reply.status ?? 200;
      const text = reply.json === undefined ? null : JSON.stringify(reply.json);
      return new Response(status === 204 ? null : text, { status });
    })
  );
}

// real.ts keeps a small cache of the trip list, so load a fresh copy for every test.
async function loadReal() {
  vi.resetModules();
  return await import("./real");
}

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Sample data shaped like the backend's JSON ───────────────────────────────

const backendTrip = {
  id: 9,
  title: "Switzerland Adventure",
  country: "Switzerland",
  startDate: "2026-12-05",
  endDate: "2026-12-12",
  travellers: 2,
  currency: "CHF",
  totalBudget: 3500.0,
  createdAt: "2026-10-13T12:15:13",
  updatedAt: "2026-10-13T12:15:13",
  destinations: [
    {
      id: 8,
      city: "Lucerne",
      country: "Switzerland",
      startDate: "2026-12-09",
      endDate: "2026-12-12",
      days: 4,
      sortOrder: 2,
      createdAt: "",
      updatedAt: "",
      activities: [
        {
          id: 10, title: "Chapel Bridge", date: "2026-12-11", category: "SIGHTSEEING",
          cost: 0, startTime: "10:00:00", endTime: "11:30:00", sortOrder: 1,
          createdAt: "", updatedAt: "",
        },
      ],
    },
    {
      id: 6,
      city: "Zurich",
      country: "Switzerland",
      startDate: "2026-12-05",
      endDate: "2026-12-08",
      days: 4,
      sortOrder: 1,
      createdAt: "",
      updatedAt: "",
      activities: [
        {
          id: 7, title: "Swiss Dinner", date: "2026-12-05", category: "FOOD",
          cost: 80, startTime: "19:00:00", endTime: "21:00:00", sortOrder: 5,
          createdAt: "", updatedAt: "",
        },
        {
          id: 6, title: "Old Town Tour", date: "2026-12-05", category: "SIGHTSEEING",
          cost: 0, startTime: "10:00:00", endTime: "12:00:00", sortOrder: 4,
          createdAt: "", updatedAt: "",
        },
      ],
    },
  ],
};

// ─── Reading data: backend JSON -> frontend types ─────────────────────────────

describe("getTrips", () => {
  it("asks for one big page and reads the trips from `content`", async () => {
    fakeBackend(() => ({ json: { content: [backendTrip], page: { totalElements: 1 } } }));
    const { getTrips } = await loadReal();

    const trips = await getTrips();

    expect(calls[0].url).toBe("/api/trips?page=0&size=500");
    expect(trips).toHaveLength(1);
  });

  it("turns numeric ids into strings and keeps money as a number", async () => {
    fakeBackend(() => ({ json: { content: [{ ...backendTrip, totalBudget: "3500.00" }] } }));
    const { getTrips } = await loadReal();

    const [trip] = await getTrips();

    expect(trip.id).toBe("9");
    expect(trip.totalBudget).toBe(3500);
    expect(trip.title).toBe("Switzerland Adventure");
  });
});

describe("getTripDetails", () => {
  async function load() {
    fakeBackend(() => ({ json: backendTrip }));
    const { getTripDetails } = await loadReal();
    return getTripDetails("9");
  }

  it("calls GET /trips/{id}", async () => {
    await load();
    expect(calls[0]).toMatchObject({ method: "GET", url: "/api/trips/9" });
  });

  it("renames startDate/endDate to arrivalDate/departureDate on destinations", async () => {
    const { destinations } = await load();
    const lucerne = destinations.find((d) => d.city === "Lucerne")!;
    expect(lucerne.arrivalDate).toBe("2026-12-09");
    expect(lucerne.departureDate).toBe("2026-12-12");
    expect(lucerne.id).toBe("8");
    expect(lucerne.tripId).toBe("9");
  });

  it("keeps the destinations in the order the backend sent them", async () => {
    const { destinations } = await load();
    expect(destinations.map((d) => d.city)).toEqual(["Lucerne", "Zurich"]);
  });

  it("converts category, times and order on activities", async () => {
    const { activities } = await load();
    const dinner = activities.find((a) => a.title === "Swiss Dinner")!;
    expect(dinner.category).toBe("food"); // FOOD -> food
    expect(dinner.startTime).toBe("19:00"); // 19:00:00 -> 19:00
    expect(dinner.endTime).toBe("21:00");
    expect(dinner.order).toBe(5); // sortOrder -> order (the backend's number, not just the position)
    expect(dinner.id).toBe("7");
    expect(dinner.cost).toBe(80);
  });

  it("links every activity to its destination", async () => {
    const { activities } = await load();
    expect(activities.find((a) => a.title === "Chapel Bridge")!.destinationId).toBe("8");
    expect(activities.find((a) => a.title === "Swiss Dinner")!.destinationId).toBe("6");
  });

  it("returns activities sorted by day, then start time", async () => {
    const { activities } = await load();
    expect(activities.map((a) => a.title)).toEqual(["Old Town Tour", "Swiss Dinner", "Chapel Bridge"]);
  });

  it("falls back to 'other' for an unknown category", async () => {
    const odd = JSON.parse(JSON.stringify(backendTrip));
    odd.destinations[0].activities[0].category = "SPACE_TRAVEL";
    fakeBackend(() => ({ json: odd }));
    const { getTripDetails } = await loadReal();

    const { activities } = await getTripDetails("9");
    expect(activities.find((a) => a.title === "Chapel Bridge")!.category).toBe("other");
  });
});

describe("getTripSummaries", () => {
  it("counts destinations and adds up the activity costs for each trip", async () => {
    fakeBackend(() => ({ json: { content: [backendTrip] } }));
    const { getTripSummaries } = await loadReal();

    expect(await getTripSummaries()).toEqual([{ tripId: "9", destinationCount: 2, spent: 80 }]);
  });

  it("copes with a trip that has no destinations", async () => {
    fakeBackend(() => ({ json: { content: [{ ...backendTrip, destinations: [] }] } }));
    const { getTripSummaries } = await loadReal();

    expect(await getTripSummaries()).toEqual([{ tripId: "9", destinationCount: 0, spent: 0 }]);
  });

  it("shares one request with getTrips when they run together", async () => {
    fakeBackend(() => ({ json: { content: [backendTrip] } }));
    const { getTrips, getTripSummaries } = await loadReal();

    await Promise.all([getTrips(), getTripSummaries()]);
    expect(calls).toHaveLength(1);
  });
});

// ─── Errors ───────────────────────────────────────────────────────────────────

describe("errors", () => {
  it("turns a 404 into a 'not found' error", async () => {
    fakeBackend(() => ({ status: 404, json: { message: "Trip not found" } }));
    const { getTripDetails } = await loadReal();
    const { isNotFound } = await import("./http");

    const err = await getTripDetails("999").catch((e) => e);
    expect(isNotFound(err)).toBe(true);
    expect(err.message).toBe("Trip not found");
  });

  it("shows the backend's own message for a 400", async () => {
    fakeBackend(() => ({
      status: 400,
      json: { message: "Destination days must total 7 days, but total 9." },
    }));
    const { getTripDetails } = await loadReal();

    await expect(getTripDetails("9")).rejects.toThrow("Destination days must total 7 days, but total 9.");
  });

  it("explains a network failure in plain words", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { getTrips } = await loadReal();

    await expect(getTrips()).rejects.toThrow(/cannot reach the server/i);
  });
});

// ─── Writing data: frontend -> backend ────────────────────────────────────────

// A trip as the form hands it over. "tmp-" ids are temporary ones for new rows;
// plain digits are real ids already stored in the backend.
const payload = {
  trip: {
    title: "Japan Trip", startDate: "2026-11-01", endDate: "2026-11-07",
    travellers: 2, currency: "JPY", totalBudget: 100000,
  },
  destinations: [
    { id: "1", city: "Tokyo", country: "Japan", arrivalDate: "2026-11-01", departureDate: "2026-11-05" },
    { id: "tmp-kyoto", city: "Kyoto", country: "Japan", arrivalDate: "2026-11-06", departureDate: "2026-11-07" },
  ],
  activities: [
    { id: "tmp-a2", destinationId: "1", title: "Dinner", category: "food" as const, cost: 50,
      date: "2026-11-02", startTime: "19:00", endTime: "21:00", order: 2 },
    { id: "5", destinationId: "1", title: "Temple", category: "sightseeing" as const, cost: 0,
      date: "2026-11-02", startTime: "10:00", endTime: "12:00", order: 1 },
    { id: "tmp-a3", destinationId: "tmp-kyoto", title: "Tea", category: "other" as const, cost: 10,
      date: "2026-11-06", startTime: "09:00", endTime: "10:00", order: 1 },
  ],
};

describe("saveTripDetails (edit a trip)", () => {
  async function save() {
    fakeBackend(() => ({ json: backendTrip }));
    const { saveTripDetails } = await loadReal();
    await saveTripDetails("9", payload);
    return calls[0];
  }

  it("makes ONE request: PUT /trips/{id}", async () => {
    await save();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: "PUT", url: "/api/trips/9" });
  });

  it("sends the trip fields and the country of the first destination", async () => {
    const { body } = await save();
    expect(body).toMatchObject({
      title: "Japan Trip", startDate: "2026-11-01", endDate: "2026-11-07",
      travellers: 2, currency: "JPY", totalBudget: 100000, country: "Japan",
    });
  });

  it("sends a number of days for each destination instead of dates", async () => {
    const { body } = await save();
    expect(body.destinations.map((d: any) => d.days)).toEqual([5, 2]);
    expect(body.destinations[0]).not.toHaveProperty("startDate");
    expect(body.destinations[0]).not.toHaveProperty("arrivalDate");
  });

  it("keeps real ids as numbers and leaves temporary ids out", async () => {
    const { body } = await save();
    expect(body.destinations[0].id).toBe(1); // existing -> update
    expect(body.destinations[1]).not.toHaveProperty("id"); // new -> create
    const [temple, dinner] = body.destinations[0].activities;
    expect(temple.id).toBe(5);
    expect(dinner).not.toHaveProperty("id");
  });

  it("keeps destinations in the order the user sees them", async () => {
    const { body } = await save();
    expect(body.destinations.map((d: any) => d.city)).toEqual(["Tokyo", "Kyoto"]);
  });

  it("puts each activity under its own destination, sorted by day, time, then order", async () => {
    const { body } = await save();
    expect(body.destinations[0].activities.map((a: any) => a.title)).toEqual(["Temple", "Dinner"]);
    expect(body.destinations[1].activities.map((a: any) => a.title)).toEqual(["Tea"]);
  });

  it("sends categories in capitals and does not send order or destinationId", async () => {
    const { body } = await save();
    const dinner = body.destinations[0].activities[1];
    expect(dinner.category).toBe("FOOD");
    expect(dinner).toMatchObject({ title: "Dinner", date: "2026-11-02", cost: 50, startTime: "19:00", endTime: "21:00" });
    expect(dinner).not.toHaveProperty("order");
    expect(dinner).not.toHaveProperty("destinationId");
  });

  it("always sends an activities list, even for a destination with none", async () => {
    fakeBackend(() => ({ json: backendTrip }));
    const { saveTripDetails } = await loadReal();
    await saveTripDetails("9", { ...payload, activities: [] });

    expect(calls[0].body.destinations.map((d: any) => d.activities)).toEqual([[], []]);
  });
});

describe("createTripDetails (create a trip)", () => {
  it("creates an empty trip first, then fills it with one PUT", async () => {
    fakeBackend((c) => (c.method === "POST" ? { status: 201, json: { ...backendTrip, id: 42 } } : { json: backendTrip }));
    const { createTripDetails } = await loadReal();

    await createTripDetails(payload);

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(["POST /api/trips", "PUT /api/trips/42"]);
    expect(calls[0].body.destinations).toEqual([]);
    expect(calls[0].body.country).toBe("Japan");
    expect(calls[1].body.destinations).toHaveLength(2);
  });

  it("returns the new trip with a string id", async () => {
    fakeBackend((c) => (c.method === "POST" ? { status: 201, json: { ...backendTrip, id: 42 } } : { json: { ...backendTrip, id: 42 } }));
    const { createTripDetails } = await loadReal();

    expect((await createTripDetails(payload)).id).toBe("42");
  });

  it("deletes the half-made trip if the PUT fails, and passes the error on", async () => {
    fakeBackend((c) => {
      if (c.method === "POST") return { status: 201, json: { ...backendTrip, id: 42 } };
      if (c.method === "PUT") return { status: 400, json: { message: "Activity date must fall within destination dates." } };
      return { status: 204 };
    });
    const { createTripDetails } = await loadReal();

    await expect(createTripDetails(payload)).rejects.toThrow("Activity date must fall within destination dates.");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/trips",
      "PUT /api/trips/42",
      "DELETE /api/trips/42",
    ]);
  });

  it("does nothing more if creating the trip itself fails", async () => {
    fakeBackend(() => ({ status: 400, json: { message: "Title cannot be blank" } }));
    const { createTripDetails } = await loadReal();

    await expect(createTripDetails(payload)).rejects.toThrow("Title cannot be blank");
    expect(calls).toHaveLength(1);
  });
});

describe("updateTrip (change a few trip fields)", () => {
  it("loads the trip, applies the change, and saves the whole trip with PUT", async () => {
    fakeBackend(() => ({ json: backendTrip }));
    const { updateTrip } = await loadReal();

    await updateTrip("9", { title: "Renamed" });

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(["GET /api/trips/9", "PUT /api/trips/9"]);
    expect(calls[1].body.title).toBe("Renamed");
    // Everything else that was already there is sent back unchanged.
    expect(calls[1].body.destinations).toHaveLength(2);
    expect(calls[1].body.destinations[0].id).toBe(8); // Lucerne keeps its id
  });
});

// ─── Smaller calls ────────────────────────────────────────────────────────────

describe("createActivity", () => {
  it("puts the date in the address and leaves it out of the body", async () => {
    fakeBackend(() => ({
      status: 201,
      json: { id: 77, title: "Boat", date: "2026-11-02", category: "ADVENTURE", cost: 20,
              startTime: "09:00:00", endTime: "10:00:00", sortOrder: 3, createdAt: "", updatedAt: "" },
    }));
    const { createActivity } = await loadReal();

    const result = await createActivity({
      destinationId: "1", title: "Boat", category: "adventure", cost: 20,
      date: "2026-11-02", startTime: "09:00", endTime: "10:00", order: 1,
    });

    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe("/api/destinations/1/activities?date=2026-11-02");
    expect(calls[0].body).toEqual({
      title: "Boat", category: "ADVENTURE", cost: 20, startTime: "09:00", endTime: "10:00",
    });
    expect(result.id).toBe("77");
    expect(result.category).toBe("adventure");
  });
});

describe("deleteTrip", () => {
  it("sends DELETE and copes with the empty 204 reply", async () => {
    fakeBackend(() => ({ status: 204 }));
    const { deleteTrip } = await loadReal();

    await expect(deleteTrip("9")).resolves.toBeUndefined();
    expect(calls[0]).toMatchObject({ method: "DELETE", url: "/api/trips/9" });
  });
});