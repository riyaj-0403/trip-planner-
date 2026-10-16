import { describe, it, expect } from "vitest";
import { buildTripPayload, findInvalidTimes } from "./buildTripPayload";

// buildTripPayload takes what the form holds (everything typed as text) and turns it
// into the clean object that gets sent to the backend. The helper below builds a
// small, valid form so each test only has to change the one thing it cares about.

type Args = Parameters<typeof buildTripPayload>[0];

function makeArgs(overrides: Partial<Args> = {}): Args {
  return {
    form: {
      title: "  Japan Trip  ",
      startDate: "2026-11-01",
      endDate: "2026-11-05",
      travellers: "2",
      currency: "JPY",
      totalBudget: "100000",
    },
    destinations: [
      { id: "d1", name: "Tokyo, Japan" },
      { id: "d2", name: "Kyoto, Japan" },
    ],
    // activities are stored per date
    activities: {
      "2026-11-01": [
        { id: "a1", name: "Temple", category: "sightseeing", startTime: "10:00", endTime: "12:00", cost: "0" },
        { id: "a2", name: "Dinner", category: "food", startTime: "19:00", endTime: "21:00", cost: "50" },
      ],
      "2026-11-04": [
        { id: "a3", name: "Tea", category: "other", startTime: "09:00", endTime: "10:00", cost: "10" },
      ],
    },
    days: ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"],
    effectiveDayCounts: [3, 2], // Tokyo 3 days, Kyoto 2 days
    dayDestinationIndex: [0, 0, 0, 1, 1], // which destination each day belongs to
    ...overrides,
  };
}

describe("buildTripPayload: trip fields", () => {
  it("trims the title and turns text numbers into real numbers", () => {
    const { payload } = buildTripPayload(makeArgs());
    expect(payload.trip).toEqual({
      title: "Japan Trip",
      startDate: "2026-11-01",
      endDate: "2026-11-05",
      travellers: 2,
      currency: "JPY",
      totalBudget: 100000,
    });
  });
});

describe("buildTripPayload: destinations", () => {
  it("splits 'City, Country' into city and country", () => {
    const { payload } = buildTripPayload(makeArgs());
    expect(payload.destinations[0]).toMatchObject({ id: "d1", city: "Tokyo", country: "Japan" });
    expect(payload.destinations[1]).toMatchObject({ id: "d2", city: "Kyoto", country: "Japan" });
  });

  it("gives each destination its dates from the day counts", () => {
    const { payload } = buildTripPayload(makeArgs());
    expect(payload.destinations[0]).toMatchObject({ arrivalDate: "2026-11-01", departureDate: "2026-11-03" });
    expect(payload.destinations[1]).toMatchObject({ arrivalDate: "2026-11-04", departureDate: "2026-11-05" });
  });

  it("follows custom day counts, not an even split", () => {
    const { payload } = buildTripPayload(makeArgs({ effectiveDayCounts: [1, 4], dayDestinationIndex: [0, 1, 1, 1, 1] }));
    expect(payload.destinations[0]).toMatchObject({ arrivalDate: "2026-11-01", departureDate: "2026-11-01" });
    expect(payload.destinations[1]).toMatchObject({ arrivalDate: "2026-11-02", departureDate: "2026-11-05" });
  });

  it("leaves the country empty when no country was typed", () => {
    const { payload } = buildTripPayload(makeArgs({ destinations: [{ id: "d1", name: "Tokyo" }, { id: "d2", name: "Kyoto" }] }));
    expect(payload.destinations[0]).toMatchObject({ city: "Tokyo", country: "" });
  });

  it("keeps anything after the first comma as the country", () => {
    const { payload } = buildTripPayload(
      makeArgs({ destinations: [{ id: "d1", name: "  Ubud ,  Bali, Indonesia " }, { id: "d2", name: "Kyoto, Japan" }] })
    );
    expect(payload.destinations[0]).toMatchObject({ city: "Ubud", country: "Bali, Indonesia" });
  });

  it("keeps the destinations in the order they were entered", () => {
    const { payload } = buildTripPayload(makeArgs());
    expect(payload.destinations.map((d) => d.city)).toEqual(["Tokyo", "Kyoto"]);
  });
});

describe("buildTripPayload: activities", () => {
  it("puts each activity under the destination its day belongs to", () => {
    const { payload } = buildTripPayload(makeArgs());
    const byTitle = Object.fromEntries(payload.activities.map((a) => [a.title, a.destinationId]));
    expect(byTitle).toEqual({ Temple: "d1", Dinner: "d1", Tea: "d2" });
  });

  it("numbers activities 1, 2, 3... within each day", () => {
    const { payload } = buildTripPayload(makeArgs());
    const order = Object.fromEntries(payload.activities.map((a) => [a.title, a.order]));
    expect(order).toEqual({ Temple: 1, Dinner: 2, Tea: 1 }); // Tea starts again at 1 on its own day
  });

  it("copies the id, date, times and category", () => {
    const { payload } = buildTripPayload(makeArgs());
    expect(payload.activities[1]).toEqual({
      id: "a2", destinationId: "d1", title: "Dinner", category: "food", cost: 50,
      date: "2026-11-01", startTime: "19:00", endTime: "21:00", order: 2,
    });
  });

  it("skips activities with a blank name and does not leave a gap in the numbering", () => {
    const { payload } = buildTripPayload(
      makeArgs({
        activities: {
          "2026-11-01": [
            { id: "a1", name: "   ", category: "food", startTime: "08:00", endTime: "09:00", cost: "5" },
            { id: "a2", name: "Breakfast", category: "food", startTime: "09:00", endTime: "10:00", cost: "5" },
          ],
        },
      })
    );
    expect(payload.activities.map((a) => [a.title, a.order])).toEqual([["Breakfast", 1]]);
  });

  it("trims the title", () => {
    const { payload } = buildTripPayload(
      makeArgs({
        activities: {
          "2026-11-01": [{ id: "a1", name: "  Museum  ", category: "other", startTime: "10:00", endTime: "11:00", cost: "0" }],
        },
      })
    );
    expect(payload.activities[0].title).toBe("Museum");
  });

  it("turns an empty or invalid cost into 0", () => {
    const { payload } = buildTripPayload(
      makeArgs({
        activities: {
          "2026-11-01": [
            { id: "a1", name: "Free", category: "other", startTime: "10:00", endTime: "11:00", cost: "" },
            { id: "a2", name: "Odd", category: "other", startTime: "11:00", endTime: "12:00", cost: "abc" },
          ],
        },
      })
    );
    expect(payload.activities.map((a) => a.cost)).toEqual([0, 0]);
  });

  it("uses 'other' when no category was chosen", () => {
    const { payload } = buildTripPayload(
      makeArgs({
        activities: {
          "2026-11-01": [{ id: "a1", name: "Walk", category: "", startTime: "10:00", endTime: "11:00", cost: "0" }],
        },
      })
    );
    expect(payload.activities[0].category).toBe("other");
  });

  it("returns no activities when none were entered", () => {
    const { payload, outOfRange } = buildTripPayload(makeArgs({ activities: {} }));
    expect(payload.activities).toEqual([]);
    expect(outOfRange).toBe(0);
  });

  it("drops activities on a day that belongs to no destination", () => {
    const { payload } = buildTripPayload(makeArgs({ dayDestinationIndex: [0, 0, 0, 5, 5] })); // 4 Nov -> destination 5 (none)
    expect(payload.activities.map((a) => a.title)).toEqual(["Temple", "Dinner"]);
  });
});

describe("buildTripPayload: activities outside the trip dates", () => {
  it("counts activities on days that no longer exist", () => {
    const { payload, outOfRange } = buildTripPayload(
      makeArgs({
        activities: {
          "2026-11-01": [{ id: "a1", name: "Inside", category: "other", startTime: "10:00", endTime: "11:00", cost: "0" }],
          "2026-11-09": [
            { id: "a2", name: "Late 1", category: "other", startTime: "10:00", endTime: "11:00", cost: "0" },
            { id: "a3", name: "Late 2", category: "other", startTime: "12:00", endTime: "13:00", cost: "0" },
            { id: "a4", name: "   ", category: "other", startTime: "14:00", endTime: "15:00", cost: "0" }, // blank, not counted
          ],
        },
      })
    );
    expect(outOfRange).toBe(2);
    expect(payload.activities.map((a) => a.title)).toEqual(["Inside"]); // the late ones are not sent
  });
});

describe("findInvalidTimes", () => {
  const ok = { id: "1", destinationId: "d", title: "Fine", category: "food" as const, cost: 0, date: "2026-11-01", order: 1 };

  it("accepts an activity that ends after it starts", () => {
    expect(findInvalidTimes([{ ...ok, startTime: "09:00", endTime: "10:00" }])).toEqual([]);
  });

  it("rejects a missing start time or end time", () => {
    const noStart = { ...ok, id: "a", startTime: "", endTime: "10:00" };
    const noEnd = { ...ok, id: "b", startTime: "09:00", endTime: "" };
    expect(findInvalidTimes([noStart, noEnd]).map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("rejects an end that is the same as, or before, the start", () => {
    const same = { ...ok, id: "a", startTime: "09:00", endTime: "09:00" };
    const before = { ...ok, id: "b", startTime: "10:00", endTime: "09:00" };
    expect(findInvalidTimes([same, before]).map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("returns only the bad ones from a mixed list", () => {
    const good = { ...ok, id: "good", startTime: "09:00", endTime: "10:00" };
    const bad = { ...ok, id: "bad", startTime: "11:00", endTime: "10:00" };
    expect(findInvalidTimes([good, bad]).map((a) => a.id)).toEqual(["bad"]);
  });

  it("returns an empty list for no activities", () => {
    expect(findInvalidTimes([])).toEqual([]);
  });
});