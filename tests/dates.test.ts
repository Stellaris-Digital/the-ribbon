import { describe, expect, it } from "vitest";
import {
  astronomicalToEra,
  civilFromDays,
  compareEndpoints,
  daysFromCivil,
  eraYearToAstronomical,
  eventGeometry,
  formatEventDate,
  validateEvent,
} from "@/lib/dates";

describe("astronomical years", () => {
  it("maps 1 BCE to year 0 and 44 BCE to year -43", () => {
    expect(eraYearToAstronomical(1, "BCE")).toBe(0);
    expect(eraYearToAstronomical(44, "BCE")).toBe(-43);
    expect(eraYearToAstronomical(753, "BCE")).toBe(-752);
    expect(eraYearToAstronomical(1789, "CE")).toBe(1789);
  });

  it("displays astronomical years as BCE and CE", () => {
    expect(astronomicalToEra(0)).toEqual({ year: 1, era: "BCE" });
    expect(astronomicalToEra(-43)).toEqual({ year: 44, era: "BCE" });
    expect(astronomicalToEra(1789)).toEqual({ year: 1789, era: "CE" });
  });

  it("sorts 44 BCE before 1789", () => {
    const bce = { year: -43, month: null, day: null, certainty: "certain" as const };
    const ce = { year: 1789, month: 7, day: 14, certainty: "certain" as const };
    expect(compareEndpoints(bce, ce)).toBeLessThan(0);
  });
});

describe("civil day numbers", () => {
  it("treats 1 January 1970 as day 0", () => {
    expect(daysFromCivil(1970, 1, 1)).toBe(0);
  });

  it("places 14 July 1789 before the epoch", () => {
    expect(daysFromCivil(1789, 7, 14)).toBeLessThan(0);
  });

  it("converts day numbers back to civil dates, including BCE", () => {
    expect(civilFromDays(0)).toEqual({ year: 1970, month: 1, day: 1 });
    expect(civilFromDays(daysFromCivil(1789, 7, 14))).toEqual({ year: 1789, month: 7, day: 14 });
    expect(civilFromDays(daysFromCivil(-752, 4, 21))).toEqual({ year: -752, month: 4, day: 21 });
  });
});

describe("formatEventDate", () => {
  it("formats a certain day, month, and year", () => {
    expect(
      formatEventDate({
        start: { year: 1789, month: 7, day: 14, certainty: "certain" },
        end: null,
        endOpen: false,
      }),
    ).toBe("14 July 1789");
    expect(
      formatEventDate({
        start: { year: 1789, month: 7, day: null, certainty: "certain" },
        end: null,
        endOpen: false,
      }),
    ).toBe("July 1789");
    expect(
      formatEventDate({
        start: { year: 1789, month: null, day: null, certainty: "certain" },
        end: null,
        endOpen: false,
      }),
    ).toBe("1789");
    expect(
      formatEventDate({
        start: { year: -43, month: null, day: null, certainty: "certain" },
        end: null,
        endOpen: false,
      }),
    ).toBe("44 BCE");
  });

  it("prefixes estimates and keeps each endpoint independent", () => {
    expect(
      formatEventDate({
        start: { year: 1500, month: null, day: null, certainty: "estimated" },
        end: null,
        endOpen: false,
      }),
    ).toBe("c. 1500");
    expect(
      formatEventDate({
        start: { year: 1200, month: null, day: null, certainty: "estimated" },
        end: { year: 1300, month: null, day: null, certainty: "estimated" },
        endOpen: false,
      }),
    ).toBe("c. 1200 – c. 1300");
    expect(
      formatEventDate({
        start: { year: 1861, month: null, day: null, certainty: "certain" },
        end: { year: 1865, month: null, day: null, certainty: "estimated" },
        endOpen: false,
      }),
    ).toBe("1861 – c. 1865");
  });

  it("formats an open range as present", () => {
    expect(
      formatEventDate({
        start: { year: 1962, month: null, day: null, certainty: "certain" },
        end: null,
        endOpen: true,
      }),
    ).toBe("1962 – present");
  });
});

describe("validateEvent", () => {
  it("accepts a certain day, an estimated year, a mixed range, and an ongoing range", () => {
    expect(
      validateEvent({
        title: "Declaration",
        summary: null,
        citation: null,
        start: { year: 4, era: "CE", month: 7, day: 14, certainty: "certain" },
        end: null,
        endOpen: false,
      }).ok,
    ).toBe(true);

    const estimated = validateEvent({
      title: "Around",
      summary: null,
      citation: null,
      start: { year: 1500, era: "CE", month: null, day: null, certainty: "estimated" },
      end: null,
      endOpen: false,
    });
    expect(estimated.ok).toBe(true);
    if (estimated.ok) expect(estimated.value.start.year).toBe(1500);

    const mixed = validateEvent({
      title: "War",
      summary: null,
      citation: null,
      start: { year: 1861, era: "CE", month: null, day: null, certainty: "certain" },
      end: { year: 1865, era: "CE", month: null, day: null, certainty: "estimated" },
      endOpen: false,
    });
    expect(mixed.ok).toBe(true);

    const ongoing = validateEvent({
      title: "Council",
      summary: null,
      citation: null,
      start: { year: 1962, era: "CE", month: null, day: null, certainty: "certain" },
      end: null,
      endOpen: true,
    });
    expect(ongoing.ok).toBe(true);
  });

  it("stores 44 BCE as astronomical year -43", () => {
    const result = validateEvent({
      title: "Caesar",
      summary: null,
      citation: null,
      start: { year: 44, era: "BCE", month: null, day: null, certainty: "certain" },
      end: null,
      endOpen: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.start.year).toBe(-43);
  });

  it("rejects a day without a month, an impossible day, and an end before the start", () => {
    expect(
      validateEvent({
        title: "Bad",
        summary: null,
        citation: null,
        start: { year: 1861, era: "CE", month: null, day: 4, certainty: "certain" },
        end: null,
        endOpen: false,
      }).ok,
    ).toBe(false);
    expect(
      validateEvent({
        title: "Bad",
        summary: null,
        citation: null,
        start: { year: 1861, era: "CE", month: 2, day: 30, certainty: "certain" },
        end: null,
        endOpen: false,
      }).ok,
    ).toBe(false);
    expect(
      validateEvent({
        title: "Bad",
        summary: null,
        citation: null,
        start: { year: 1865, era: "CE", month: null, day: null, certainty: "certain" },
        end: { year: 1861, era: "CE", month: null, day: null, certainty: "certain" },
        endOpen: false,
      }).ok,
    ).toBe(false);
  });
});

describe("eventGeometry", () => {
  it("draws a day-precision point as a tick and a year-precision point across that year", () => {
    const tick = eventGeometry({
      start: { year: 1789, month: 7, day: 14, certainty: "certain" },
      end: null,
      endOpen: false,
    });
    expect(tick.tick).toBe(true);
    expect(tick.startHatched).toBe(false);
    expect(tick.endDay - tick.startDay).toBe(1);

    const year = eventGeometry({
      start: { year: 1066, month: null, day: null, certainty: "certain" },
      end: null,
      endOpen: false,
    });
    expect(year.tick).toBe(false);
    expect(year.startHatched).toBe(true);
    expect(year.endDay).toBe(daysFromCivil(1067, 1, 1));
    expect(year.startDay).toBe(daysFromCivil(1066, 1, 1));
  });

  it("hatches an estimated endpoint and leaves a certain day solid", () => {
    const estimated = eventGeometry({
      start: { year: 1500, month: null, day: null, certainty: "estimated" },
      end: { year: 1510, month: 6, day: 1, certainty: "certain" },
      endOpen: false,
    });
    expect(estimated.startHatched).toBe(true);
    expect(estimated.endHatched).toBe(false);
  });
});
