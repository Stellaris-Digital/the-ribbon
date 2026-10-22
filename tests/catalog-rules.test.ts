import { describe, expect, it } from "vitest";
import { assertAdminRole } from "@/lib/auth-role";
import { eventMatchesRibbon } from "@/lib/filters";
import { labelBox, layoutRibbon } from "@/lib/layout";
import { placeNameAt } from "@/lib/places";
import { canDeleteNode, eventColor, wouldCreateCycle } from "@/lib/trees";
import { axisTicks, clampView, decayVelocity, fitCatalog, panByPixels, zoomAt } from "@/lib/timeline-math";
import { daysFromCivil } from "@/lib/dates";
import { parseViewState, serializeViewState } from "@/lib/url-state";

const labels = [
  { id: "us", parentId: null, position: 0, color: "#1d4ed8" },
  { id: "revolution", parentId: "us", position: 0, color: "#b91c1c" },
  { id: "civil", parentId: "us", position: 1, color: "#a16207" },
  { id: "church", parentId: null, position: 1, color: "#6d28d9" },
];

const places = [
  { id: "europe", parentId: null },
  { id: "italy", parentId: "europe" },
  { id: "rome", parentId: "italy" },
];

const declaration = {
  id: "declaration",
  labelIds: ["revolution"],
  placeIds: ["rome"],
};

describe("ribbon filters", () => {
  it("includes descendants and combines labels with OR and labels with places with AND", () => {
    expect(
      eventMatchesRibbon(declaration, { labelIds: ["revolution"], placeIds: [], showAll: false }, labels, places),
    ).toBe(true);
    expect(
      eventMatchesRibbon(declaration, { labelIds: ["us"], placeIds: [], showAll: false }, labels, places),
    ).toBe(true);
    expect(
      eventMatchesRibbon(declaration, { labelIds: ["civil"], placeIds: [], showAll: false }, labels, places),
    ).toBe(false);
    expect(
      eventMatchesRibbon(declaration, { labelIds: [], placeIds: ["italy"], showAll: false }, labels, places),
    ).toBe(true);
    expect(
      eventMatchesRibbon(
        declaration,
        { labelIds: ["civil"], placeIds: ["europe"], showAll: false },
        labels,
        places,
      ),
    ).toBe(false);
    expect(
      eventMatchesRibbon(
        declaration,
        { labelIds: ["revolution", "civil"], placeIds: [], showAll: false },
        labels,
        places,
      ),
    ).toBe(true);
  });

  it("shows every event on an empty show-all ribbon and nothing on an empty added ribbon", () => {
    expect(
      eventMatchesRibbon(declaration, { labelIds: [], placeIds: [], showAll: true }, labels, places),
    ).toBe(true);
    expect(
      eventMatchesRibbon(declaration, { labelIds: [], placeIds: [], showAll: false }, labels, places),
    ).toBe(false);
  });
});

describe("trees", () => {
  it("uses the first label in tree order for color", () => {
    expect(eventColor(["civil", "revolution"], labels)).toBe("#b91c1c");
  });

  it("rejects a parent assignment that would cycle", () => {
    const nodes = [
      { id: "a", parentId: null },
      { id: "b", parentId: "a" },
      { id: "c", parentId: "b" },
    ];
    expect(wouldCreateCycle(nodes, "a", "c")).toBe(true);
    expect(wouldCreateCycle(nodes, "a", "a")).toBe(true);
    expect(wouldCreateCycle(nodes, "c", null)).toBe(false);
  });

  it("blocks deletion while children or events still reference the node", () => {
    expect(canDeleteNode("us", labels, new Set())).toEqual({
      ok: false,
      reason: "Move or remove nested items first.",
    });
    expect(canDeleteNode("revolution", labels, new Set(["revolution"]))).toEqual({
      ok: false,
      reason: "Remove this from events first.",
    });
    expect(canDeleteNode("revolution", labels, new Set()).ok).toBe(true);
  });
});

describe("historical place names", () => {
  const rome = {
    name: "Rome",
    names: [
      { name: "Roma", startYear: -100, endYear: 400 },
      { name: "Constantinople", startYear: null, endYear: null },
    ],
  };

  it("uses the dated name that contains the event year, else the current name", () => {
    expect(placeNameAt(rome, 100)).toBe("Roma");
    expect(placeNameAt({ name: "Rome", names: [{ name: "Roma", startYear: -100, endYear: 400 }] }, 2000)).toBe(
      "Rome",
    );
  });

  it("prefers the name with the latest start year when ranges overlap", () => {
    expect(placeNameAt(rome, 100)).toBe("Roma");
  });
});

describe("timeline math", () => {
  it("zooms toward the instant under the cursor", () => {
    const next = zoomAt({ startDay: 0, endDay: 1000 }, 0.25, 2);
    expect(next.startDay).toBe(125);
    expect(next.endDay).toBe(625);
    const ratio = (250 - next.startDay) / (next.endDay - next.startDay);
    expect(ratio).toBeCloseTo(0.25);
  });

  it("pans with the pointer and decays velocity", () => {
    const next = panByPixels({ startDay: 0, endDay: 1000 }, 100, 1000);
    expect(next.startDay).toBe(-100);
    expect(next.endDay).toBe(900);
    expect(decayVelocity(10, 0.9)).toBeCloseTo(9);
    expect(Math.abs(decayVelocity(0.05, 0.9))).toBeLessThan(0.1);
  });

  it("labels century-scale axes with years", () => {
    const ticks = axisTicks(
      { startDay: daysFromCivil(1700, 1, 1), endDay: daysFromCivil(1900, 1, 1) },
      800,
    );
    expect(ticks.length).toBeGreaterThan(3);
    expect(ticks.some((tick) => tick.label.includes("1800"))).toBe(true);
  });

  it("fits the catalog and refuses a span shorter than a day or wider than the padded catalog", () => {
    const fitted = fitCatalog(0, 1000, 0.05);
    expect(fitted.startDay).toBeLessThan(0);
    expect(fitted.endDay).toBeGreaterThan(1000);

    const clampedIn = clampView({ startDay: 0, endDay: 0.2 }, { startDay: 0, endDay: 10000 }, 1);
    expect(clampedIn.endDay - clampedIn.startDay).toBeGreaterThanOrEqual(1);

    const clampedOut = clampView({ startDay: -5000, endDay: 50000 }, { startDay: 0, endDay: 1000 }, 1);
    expect(clampedOut.startDay).toBeGreaterThanOrEqual(-50);
    expect(clampedOut.endDay).toBeLessThanOrEqual(1050);
  });
});

describe("url state", () => {
  it("round-trips ribbons and the visible range", () => {
    const state = {
      view: { startDay: 100, endDay: 400 },
      ribbons: [
        { caption: "All events", showAll: true, labelIds: [], placeIds: [] },
        { caption: "US history", showAll: false, labelIds: ["us", "revolution"], placeIds: ["rome"] },
      ],
    };
    const params = new URLSearchParams(serializeViewState(state));
    expect(parseViewState(params)).toEqual(state);
  });
});

describe("layout", () => {
  it("places separate events as nodes on one line", () => {
    const laid = layoutRibbon({
      events: [
        { id: "a", title: "Declaration of Independence", color: "#000", startDay: 0, endDay: 10, startHatched: false, endHatched: false, tick: false },
        { id: "b", title: "Constitution signed", color: "#000", startDay: 5, endDay: 15, startHatched: false, endHatched: false, tick: false },
      ],
      viewStart: 0,
      viewEnd: 20,
      width: 500,
      height: 200,
    });
    expect(laid.nodes).toHaveLength(2);
    expect(laid.clusters).toHaveLength(0);
    expect(laid.nodes[0].x).toBeLessThan(laid.nodes[1].x);
    expect(laid.nodes[0].side).not.toBe(laid.nodes[1].side);
  });

  it("groups nodes that would sit on top of each other", () => {
    const laid = layoutRibbon({
      events: Array.from({ length: 20 }, (_, index) => ({
        id: `e${index}`,
        title: `Event ${index}`,
        color: "#000",
        startDay: index * 365,
        endDay: index * 365 + 10,
        startHatched: false,
        endHatched: false,
        tick: true,
      })),
      viewStart: 0,
      viewEnd: 36500,
      width: 400,
      height: 80,
    });
    expect(laid.clusters.some((cluster) => cluster.count > 1)).toBe(true);
    expect(laid.clusters.reduce((sum, cluster) => sum + cluster.count, 0) + laid.nodes.length).toBe(20);
  });

  it("gives overlapping titles their own rows instead of stacking the text", () => {
    const laid = layoutRibbon({
      events: [
        { id: "a", title: "Second Council of Nicaea", color: "#000", startDay: 70, endDay: 71, startHatched: false, endHatched: false, tick: true },
        { id: "b", title: "Pontificate of Gregory", color: "#000", startDay: 78, endDay: 79, startHatched: false, endHatched: false, tick: true },
        { id: "c", title: "Charlemagne crowned emperor", color: "#000", startDay: 86, endDay: 87, startHatched: false, endHatched: false, tick: true },
      ],
      viewStart: 0,
      viewEnd: 100,
      width: 400,
      height: 360,
    });
    const shown = laid.nodes.filter((node) => node.showLabel);
    expect(shown).toHaveLength(3);
    for (let index = 0; index < shown.length; index += 1) {
      for (let other = index + 1; other < shown.length; other += 1) {
        const first = shown[index];
        const second = shown[other];
        if (first.side !== second.side || first.lane !== second.lane) continue;
        const a = labelBox(first);
        const b = labelBox(second);
        expect(a.right + 12 <= b.left || b.right + 12 <= a.left).toBe(true);
      }
    }
  });

  it("leaves titles for events outside the view off the line", () => {
    const laid = layoutRibbon({
      events: [
        { id: "off", title: "Jamestown settled", color: "#000", startDay: 500, endDay: 510, startHatched: false, endHatched: false, tick: true },
      ],
      viewStart: 0,
      viewEnd: 100,
      width: 400,
      height: 200,
    });
    expect(laid.nodes).toHaveLength(0);
  });
});

describe("admin role", () => {
  it("allows only an admin role", () => {
    expect(() => assertAdminRole("admin")).not.toThrow();
    expect(() => assertAdminRole("user")).toThrow(/Unauthorized/);
    expect(() => assertAdminRole(null)).toThrow(/Unauthorized/);
  });
});
