import { describe, it, expect } from "vitest";
import {
  parseIso,
  addDaysIso,
  dayCountBetween,
  eachDay,
  splitDays,
  dayCountsFromDestinations,
  dateRangesFromCounts,
  compareActivities,
} from "./tripDates";

// A "describe" groups tests for one function. Each "it" is one example of how
// that function should behave. "expect(actual).toBe(expected)" fails the test
// when the real result is different from what we wrote down.

describe("parseIso", () => {
  it("turns a date string into UTC midnight in milliseconds", () => {
    expect(parseIso("1970-01-01")).toBe(0);
    expect(parseIso("2026-11-05")).toBe(Date.UTC(2026, 10, 5));
  });
});

describe("addDaysIso", () => {
  it("adds days within a month", () => {
    expect(addDaysIso("2026-11-01", 4)).toBe("2026-11-05");
  });

  it("returns the same date when adding 0 days", () => {
    expect(addDaysIso("2026-11-01", 0)).toBe("2026-11-01");
  });

  it("rolls over the end of a month", () => {
    expect(addDaysIso("2026-11-29", 3)).toBe("2026-12-02");
  });

  it("rolls over the end of a year", () => {
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles leap days", () => {
    expect(addDaysIso("2028-02-28", 1)).toBe("2028-02-29"); // 2028 is a leap year
    expect(addDaysIso("2026-02-28", 1)).toBe("2026-03-01"); // 2026 is not
  });

  it("goes backwards with a negative offset", () => {
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("dayCountBetween", () => {
  it("counts both the first and the last day", () => {
    expect(dayCountBetween("2026-11-01", "2026-11-05")).toBe(5);
  });

  it("counts a single day as 1", () => {
    expect(dayCountBetween("2026-11-01", "2026-11-01")).toBe(1);
  });

  it("works across a month boundary", () => {
    expect(dayCountBetween("2026-11-28", "2026-12-03")).toBe(6);
  });

  it("returns 0 when a date is missing", () => {
    expect(dayCountBetween("", "2026-11-05")).toBe(0);
    expect(dayCountBetween("2026-11-01", "")).toBe(0);
  });

  it("returns 0 when the end is before the start", () => {
    expect(dayCountBetween("2026-11-05", "2026-11-01")).toBe(0);
  });
});

describe("eachDay", () => {
  it("lists every date from start to end", () => {
    expect(eachDay("2026-11-29", "2026-12-02")).toEqual([
      "2026-11-29",
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
    ]);
  });

  it("returns an empty list for an invalid range", () => {
    expect(eachDay("2026-11-05", "2026-11-01")).toEqual([]);
  });
});

describe("splitDays", () => {
  it("splits evenly when the days divide exactly", () => {
    expect(splitDays(9, 3)).toEqual([3, 3, 3]);
  });

  it("gives the extra days to the first destinations", () => {
    expect(splitDays(10, 3)).toEqual([4, 3, 3]);
    expect(splitDays(11, 3)).toEqual([4, 4, 3]);
  });

  it("always adds up to the total", () => {
    for (let total = 1; total <= 30; total++) {
      for (let count = 1; count <= 6; count++) {
        const sum = splitDays(total, count).reduce((a, b) => a + b, 0);
        expect(sum).toBe(total);
      }
    }
  });

  it("returns an empty list when there is nothing to split", () => {
    expect(splitDays(0, 3)).toEqual([]);
    expect(splitDays(5, 0)).toEqual([]);
  });
});

describe("dayCountsFromDestinations", () => {
  const tripStart = "2026-11-01";
  const tripEnd = "2026-11-09"; // 9 days

  it("reads days per destination from saved dates", () => {
    const dests = [
      { arrivalDate: "2026-11-01", departureDate: "2026-11-05" },
      { arrivalDate: "2026-11-06", departureDate: "2026-11-09" },
    ];
    expect(dayCountsFromDestinations(dests, tripStart, tripEnd)).toEqual([5, 4]);
  });

  it("returns null when there are no destinations", () => {
    expect(dayCountsFromDestinations([], tripStart, tripEnd)).toBeNull();
  });

  it("returns null when there is a gap between destinations", () => {
    const dests = [
      { arrivalDate: "2026-11-01", departureDate: "2026-11-04" },
      { arrivalDate: "2026-11-06", departureDate: "2026-11-09" }, // 5 Nov is missing
    ];
    expect(dayCountsFromDestinations(dests, tripStart, tripEnd)).toBeNull();
  });

  it("returns null when the first destination does not start on the trip start", () => {
    const dests = [{ arrivalDate: "2026-11-02", departureDate: "2026-11-09" }];
    expect(dayCountsFromDestinations(dests, tripStart, tripEnd)).toBeNull();
  });

  it("returns null when the destinations do not cover the whole trip", () => {
    const dests = [{ arrivalDate: "2026-11-01", departureDate: "2026-11-05" }];
    expect(dayCountsFromDestinations(dests, tripStart, tripEnd)).toBeNull();
  });

  it("returns null when a date is missing or the departure is before the arrival", () => {
    expect(
      dayCountsFromDestinations([{ arrivalDate: "2026-11-01", departureDate: "" }], tripStart, tripEnd)
    ).toBeNull();
    expect(
      dayCountsFromDestinations(
        [{ arrivalDate: "2026-11-01", departureDate: "2026-10-30" }],
        tripStart,
        tripEnd
      )
    ).toBeNull();
  });
});

describe("dateRangesFromCounts", () => {
  it("lays destinations out one after another from the trip start", () => {
    expect(dateRangesFromCounts("2026-11-01", [3, 2])).toEqual([
      { arrivalDate: "2026-11-01", departureDate: "2026-11-03" },
      { arrivalDate: "2026-11-04", departureDate: "2026-11-05" },
    ]);
  });

  it("works across a month boundary", () => {
    expect(dateRangesFromCounts("2026-11-29", [2, 3])).toEqual([
      { arrivalDate: "2026-11-29", departureDate: "2026-11-30" },
      { arrivalDate: "2026-12-01", departureDate: "2026-12-03" },
    ]);
  });

  it("is the reverse of dayCountsFromDestinations", () => {
    const counts = [5, 2, 4];
    const ranges = dateRangesFromCounts("2026-11-01", counts);
    expect(dayCountsFromDestinations(ranges, "2026-11-01", "2026-11-11")).toEqual(counts);
  });

  it("returns nothing for no destinations", () => {
    expect(dateRangesFromCounts("2026-11-01", [])).toEqual([]);
  });
});

describe("compareActivities", () => {
  it("puts the earlier start time first", () => {
    const early = { startTime: "09:00", order: 5 };
    const late = { startTime: "10:00", order: 1 };
    expect(compareActivities(early, late)).toBeLessThan(0);
    expect(compareActivities(late, early)).toBeGreaterThan(0);
  });

  it("uses the saved order when the start times are the same", () => {
    const first = { startTime: "09:00", order: 1 };
    const second = { startTime: "09:00", order: 2 };
    expect(compareActivities(first, second)).toBeLessThan(0);
  });

  it("treats identical activities as equal", () => {
    const a = { startTime: "09:00", order: 1 };
    expect(compareActivities(a, { ...a })).toBe(0);
  });

  it("sorts a list by time, then order", () => {
    const list = [
      { id: "c", startTime: "14:00", order: 1 },
      { id: "b", startTime: "09:00", order: 2 },
      { id: "a", startTime: "09:00", order: 1 },
    ];
    expect([...list].sort(compareActivities).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("timezones", () => {
  it("never shifts a date by a day (the bug this file was written to avoid)", () => {
    // Runs the same in every timezone because all the maths is done in UTC.
    expect(addDaysIso("2026-11-01", 0)).toBe("2026-11-01");
    expect(eachDay("2026-03-28", "2026-03-30")).toEqual(["2026-03-28", "2026-03-29", "2026-03-30"]);
  });
});