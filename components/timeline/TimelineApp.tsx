"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { drawTimeline } from "@/components/timeline/draw";
import { FilterTree } from "@/components/timeline/FilterTree";
import { AXIS_HEIGHT, ribbonHits, ROW_HEIGHT, type TimelineHit } from "@/components/timeline/geometry";
import type { Catalog, CatalogEvent } from "@/lib/catalog-types";
import { eventGeometry, formatEventDate } from "@/lib/dates";
import { eventMatchesRibbon } from "@/lib/filters";
import { layoutRibbon } from "@/lib/layout";
import { placeNameAt } from "@/lib/places";
import { eventColor } from "@/lib/trees";
import { clampView, decayVelocity, fitCatalog, panByPixels, wheelPanPixels, zoomAt, type TimeView } from "@/lib/timeline-math";
import { defaultViewState, parseViewState, serializeViewState, type RibbonState } from "@/lib/url-state";

type UiRibbon = RibbonState & { key: string };

const MAX_RIBBONS = 8;

function stamp(ribbons: RibbonState[]): UiRibbon[] {
  return ribbons.map((ribbon, index) => ({ ...ribbon, key: `ribbon-${index}` }));
}

function catalogBounds(events: CatalogEvent[]): TimeView {
  if (events.length === 0) {
    const today = eventGeometry({
      start: { year: new Date().getUTCFullYear(), month: 1, day: 1, certainty: "certain" },
      end: null,
      endOpen: false,
    });
    return { startDay: today.startDay - 36500, endDay: today.endDay };
  }
  let startDay = Infinity;
  let endDay = -Infinity;
  for (const event of events) {
    const geometry = eventGeometry(event);
    startDay = Math.min(startDay, geometry.startDay);
    endDay = Math.max(endDay, geometry.endDay);
  }
  return { startDay, endDay };
}

export function TimelineApp({ catalog, initialQuery }: { catalog: Catalog; initialQuery: string }) {
  const bounds = useMemo(() => catalogBounds(catalog.events), [catalog.events]);
  const initial = useMemo(() => {
    const parsed = parseViewState(new URLSearchParams(initialQuery));
    if (!parsed) return { ...defaultViewState(fitCatalog(bounds.startDay, bounds.endDay)), ribbons: stamp(defaultViewState(bounds).ribbons) };
    return {
      view: clampView(parsed.view, bounds, 1),
      ribbons: stamp(parsed.ribbons.slice(0, MAX_RIBBONS)),
    };
  }, [bounds, initialQuery]);

  const [view, setView] = useState<TimeView>(initial.view);
  const [ribbons, setRibbons] = useState<UiRibbon[]>(initial.ribbons);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ title: string; x: number; y: number } | null>(null);
  const [filterKey, setFilterKey] = useState<string | null>(null);
  const [width, setWidth] = useState(800);
  const [frameHeight, setFrameHeight] = useState(640);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitsRef = useRef<TimelineHit[]>([]);
  const viewRef = useRef(view);

  const canvasHeight = Math.max(AXIS_HEIGHT + ribbons.length * ROW_HEIGHT, frameHeight);
  const rowHeight = (canvasHeight - AXIS_HEIGHT) / Math.max(ribbons.length, 1);
  const rowHeights = ribbons.map(() => rowHeight);

  const prepared = useMemo(() => {
    return ribbons.map((ribbon) => {
      const events = catalog.events.filter((event) =>
        eventMatchesRibbon(event, ribbon, catalog.labels, catalog.places),
      );
      const layoutEvents = events.map((event) => ({
        id: event.id,
        title: event.title,
        color: eventColor(event.labelIds, catalog.labels),
        ...eventGeometry(event),
      }));
      const layout = layoutRibbon({
        events: layoutEvents,
        viewStart: view.startDay,
        viewEnd: view.endDay,
        width: Math.max(width, 1),
        height: rowHeight,
      });
      return { layout };
    });
  }, [catalog, ribbons, rowHeight, view, width]);

  const hits = useMemo(() => {
    const next: TimelineHit[] = [];
    let top = AXIS_HEIGHT;
    prepared.forEach((row, index) => {
      next.push(...ribbonHits(row.layout, top, rowHeights[index] ?? 0));
      top += rowHeights[index] ?? 0;
    });
    return next;
  }, [prepared, rowHeights]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    hitsRef.current = hits;
  }, [hits]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 800;
      const nextHeight = entries[0]?.contentRect.height ?? 640;
      setWidth(Math.max(1, Math.floor(next)));
      setFrameHeight(Math.max(ROW_HEIGHT, Math.floor(nextHeight)));
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(canvasHeight * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTimeline(context, {
      width,
      height: canvasHeight,
      view,
      layouts: prepared.map((row) => row.layout),
      rowHeights,
      selectedId,
      messages: ribbons.map((ribbon) =>
        ribbon.showAll ? "No events in this range." : "Choose a label or a place.",
      ),
    });
  }, [canvasHeight, prepared, ribbons, rowHeights, selectedId, view, width]);

  useEffect(() => {
    const state = {
      view,
      ribbons: ribbons.map(({ caption, showAll, labelIds, placeIds }) => ({
        caption,
        showAll,
        labelIds,
        placeIds,
      })),
    };
    const current = parseViewState(new URLSearchParams(window.location.search));
    if (JSON.stringify(current) === JSON.stringify(state)) return;
    window.history.replaceState(null, "", `/?${serializeViewState(state)}`);
  }, [ribbons, view]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { distance: number; view: TimeView; ratio: number } | null = null;
    let drag: { lastX: number; lastT: number; moved: number } | null = null;
    let velocity = 0;
    let inertia = 0;
    let coastTimer = 0;
    let lastWheelT = 0;

    const stopInertia = () => {
      if (inertia) cancelAnimationFrame(inertia);
      inertia = 0;
      velocity = 0;
      lastWheelT = 0;
      window.clearTimeout(coastTimer);
    };
    const coast = () => {
      if (reduced || Math.abs(velocity) < 0.02) {
        velocity = 0;
        return;
      }
      let last = performance.now();
      const step = (now: number) => {
        const dt = now - last;
        last = now;
        velocity = decayVelocity(velocity, Math.pow(0.92, dt / 16.67));
        if (Math.abs(velocity) < 0.01) {
          inertia = 0;
          return;
        }
        const currentWidth = canvas.getBoundingClientRect().width || 1;
        setView((current) => clampView(panByPixels(current, velocity * dt, currentWidth), bounds, 1));
        inertia = requestAnimationFrame(step);
      };
      inertia = requestAnimationFrame(step);
    };
    const point = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width };
    };
    const hitAt = (x: number, y: number) =>
      hitsRef.current.find((hit) => x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h);

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      if (event.shiftKey && pointers.size === 0) {
        if (inertia) cancelAnimationFrame(inertia);
        inertia = 0;
        window.clearTimeout(coastTimer);
        const width = rect.width || 1;
        const dx = wheelPanPixels(event.deltaX, event.deltaY, event.deltaMode, width);
        const dt = event.timeStamp - lastWheelT;
        velocity = dt > 0 && dt < 100 ? dx / dt : 0;
        lastWheelT = event.timeStamp;
        setView((current) => clampView(panByPixels(current, dx, width), bounds, 1));
        coastTimer = window.setTimeout(() => {
          lastWheelT = 0;
          coast();
        }, 100);
        return;
      }
      stopInertia();
      const ratio = (event.clientX - rect.left) / rect.width;
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      const factor = Math.min(4, Math.max(0.25, Math.exp(-delta * 0.0012)));
      setView((current) => clampView(zoomAt(current, ratio, factor), bounds, 1));
    };

    const onDown = (event: PointerEvent) => {
      canvas.setPointerCapture(event.pointerId);
      stopInertia();
      const pos = point(event);
      pointers.set(event.pointerId, pos);
      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        pinch = {
          distance: Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1),
          view: viewRef.current,
          ratio: (a.x + b.x) / 2 / pos.width,
        };
        drag = null;
      } else {
        drag = { lastX: pos.x, lastT: event.timeStamp, moved: 0 };
      }
    };

    const onMove = (event: PointerEvent) => {
      const pos = point(event);
      if (!pointers.has(event.pointerId)) {
        const hit = hitAt(pos.x, pos.y);
        canvas.style.cursor = hit ? "pointer" : "grab";
        setHover(hit ? { title: hit.title, x: pos.x, y: pos.y } : null);
        return;
      }
      pointers.set(event.pointerId, pos);
      if (pointers.size >= 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const distance = Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1);
        setView(clampView(zoomAt(pinch.view, pinch.ratio, distance / pinch.distance), bounds, 1));
        return;
      }
      if (!drag) return;
      const dx = pos.x - drag.lastX;
      const dt = event.timeStamp - drag.lastT;
      drag.moved += Math.abs(dx);
      if (dt > 0) velocity = dx / dt;
      drag.lastX = pos.x;
      drag.lastT = event.timeStamp;
      setView((current) => clampView(panByPixels(current, dx, pos.width), bounds, 1));
    };

    const onUp = (event: PointerEvent) => {
      const pos = point(event);
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size > 0 || !drag) return;
      const click = drag.moved < 5;
      drag = null;
      if (click) {
        const hit = hitAt(pos.x, pos.y);
        if (hit?.zoom) setView(clampView(hit.zoom, bounds, 1));
        setSelectedId(hit?.zoom ? null : (hit?.eventId ?? null));
        canvas.style.cursor = hit ? "pointer" : "grab";
        velocity = 0;
        return;
      }
      coast();
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    return () => {
      stopInertia();
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [bounds]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const currentWidth = canvasRef.current?.getBoundingClientRect().width || width;
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setView((current) => clampView(zoomAt(current, 0.5, 1.25), bounds, 1));
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setView((current) => clampView(zoomAt(current, 0.5, 1 / 1.25), bounds, 1));
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setView((current) => clampView(panByPixels(current, 80, currentWidth), bounds, 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setView((current) => clampView(panByPixels(current, -80, currentWidth), bounds, 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bounds, width]);

  const selected = catalog.events.find((event) => event.id === selectedId) ?? null;

  function updateRibbon(key: string, patch: Partial<UiRibbon>) {
    setRibbons((current) => current.map((ribbon) => (ribbon.key === key ? { ...ribbon, ...patch } : ribbon)));
  }

  function moveRibbon(index: number, direction: number) {
    setRibbons((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }

  const filterRibbon = ribbons.find((ribbon) => ribbon.key === filterKey) ?? null;

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-[#f3efe6] text-[#241c15]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6dcc8] px-4 py-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">The Ribbon</h1>
          <p className="text-sm text-stone-600">Scroll to zoom. Drag, or hold Shift and scroll, to pan. The ribbons share one time scale.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full bg-[#241c15] px-4 py-2 text-sm text-[#f7f1e4] disabled:opacity-40"
            disabled={ribbons.length >= MAX_RIBBONS}
            onClick={() => {
              const key = `ribbon-${crypto.randomUUID()}`;
              setRibbons((current) =>
                current.length >= MAX_RIBBONS
                  ? current
                  : [...current, { key, caption: "Timeline", showAll: false, labelIds: [], placeIds: [] }],
              );
              setFilterKey(key);
            }}
          >
            Add ribbon
          </button>
          <Link className="rounded-full border border-[#d9cdb8] px-4 py-2 text-sm" href="/admin">
            Admin
          </Link>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 overflow-auto">
            <div className="flex w-72 shrink-0 flex-col border-r border-[#e6dcc8] bg-[#f7f1e4]">
              <div style={{ height: AXIS_HEIGHT }} />
              {ribbons.map((ribbon, index) => (
                <section key={ribbon.key} className="flex flex-col justify-center border-b border-[#e6dcc8] p-3" style={{ height: rowHeights[index] }}>
                  <input
                    aria-label="Ribbon caption"
                    className="w-full bg-transparent text-sm font-medium outline-none"
                    value={ribbon.caption}
                    onChange={(event) => updateRibbon(ribbon.key, { caption: event.target.value })}
                  />
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-600">
                    <button type="button" onClick={() => setFilterKey(ribbon.key)}>
                      Filter
                    </button>
                    <button type="button" onClick={() => moveRibbon(index, -1)} aria-label="Move ribbon up">
                      Up
                    </button>
                    <button type="button" onClick={() => moveRibbon(index, 1)} aria-label="Move ribbon down">
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRibbons((current) => (current.length === 1 ? current : current.filter((item) => item.key !== ribbon.key)))
                      }
                    >
                      Remove
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-stone-500">
                    {ribbon.labelIds.length + ribbon.placeIds.length === 0
                      ? ribbon.showAll
                        ? "All events"
                        : "Nothing shown until you filter"
                      : `${ribbon.labelIds.length} labels · ${ribbon.placeIds.length} places`}
                  </p>
                </section>
              ))}
            </div>
            <div ref={frameRef} className="relative min-h-full min-w-0 flex-1">
              <canvas ref={canvasRef} className="block cursor-grab touch-none" style={{ width, height: canvasHeight }} />
              {hover ? (
                <div
                  className="pointer-events-none absolute z-10 max-w-xs rounded bg-[#241c15] px-2 py-1 text-xs text-[#f7f1e4]"
                  style={{ left: hover.x + 12, top: hover.y + 12 }}
                >
                  {hover.title}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {filterRibbon ? (
          <div className="fixed bottom-4 left-4 z-30 max-h-[70vh] w-80 overflow-auto rounded-lg border border-[#e6dcc8] bg-[#fffdf8] p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{filterRibbon.caption}</h2>
              <button type="button" className="text-sm text-stone-500" onClick={() => setFilterKey(null)}>
                Close
              </button>
            </div>
            <div className="space-y-3">
              <FilterTree
                label="Labels"
                nodes={catalog.labels}
                selected={filterRibbon.labelIds}
                onChange={(labelIds) => updateRibbon(filterRibbon.key, { labelIds })}
              />
              <FilterTree
                label="Places"
                nodes={catalog.places}
                selected={filterRibbon.placeIds}
                onChange={(placeIds) => updateRibbon(filterRibbon.key, { placeIds })}
              />
              <p className="text-xs text-stone-500">A checked parent includes everything nested under it.</p>
            </div>
          </div>
        ) : null}
        {selected ? (
          <aside className="w-80 shrink-0 overflow-auto border-l border-[#e6dcc8] bg-[#fffdf8] p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">{selected.title}</h2>
              <button type="button" className="text-sm text-stone-500" onClick={() => setSelectedId(null)}>
                Close
              </button>
            </div>
            <p className="mt-2 text-sm">{formatEventDate(selected)}</p>
            {selected.summary ? <p className="mt-3 text-sm leading-6 text-stone-700">{selected.summary}</p> : null}
            {selected.citation ? <p className="mt-3 text-sm text-stone-600">Source: {selected.citation}</p> : null}
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-stone-500">Labels</p>
            <ul className="mt-1 text-sm">
              {selected.labelIds.length === 0 ? <li>None</li> : null}
              {selected.labelIds.map((id) => {
                const label = catalog.labels.find((item) => item.id === id);
                return <li key={id}>{label?.name ?? id}</li>;
              })}
            </ul>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-stone-500">Places</p>
            <ul className="mt-1 text-sm">
              {selected.placeIds.length === 0 ? <li>None</li> : null}
              {selected.placeIds.map((id) => {
                const place = catalog.places.find((item) => item.id === id);
                if (!place) return <li key={id}>{id}</li>;
                return <li key={id}>{placeNameAt(place, selected.start.year)}</li>;
              })}
            </ul>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
