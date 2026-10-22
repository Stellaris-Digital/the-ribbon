import { astronomicalToEra, civilFromDays, daysFromCivil } from "@/lib/dates";

export type TimeView = { startDay: number; endDay: number };

const FIT_PADDING = 0.05;

export function zoomAt(view: TimeView, cursorRatio: number, factor: number): TimeView {
  const span = view.endDay - view.startDay;
  const nextSpan = span / factor;
  const anchor = view.startDay + cursorRatio * span;
  const startDay = anchor - cursorRatio * nextSpan;
  return { startDay, endDay: startDay + nextSpan };
}

export function panByPixels(view: TimeView, dx: number, width: number): TimeView {
  const span = view.endDay - view.startDay;
  const shift = width === 0 ? 0 : (dx / width) * span;
  return { startDay: view.startDay - shift, endDay: view.endDay - shift };
}

export function decayVelocity(velocity: number, friction: number): number {
  return velocity * friction;
}

export function fitCatalog(startDay: number, endDay: number, paddingRatio = FIT_PADDING): TimeView {
  const span = Math.max(endDay - startDay, 1);
  const pad = span * paddingRatio;
  return { startDay: startDay - pad, endDay: endDay + pad };
}

export function clampView(view: TimeView, catalog: TimeView, minSpanDays: number): TimeView {
  const fitted = fitCatalog(catalog.startDay, catalog.endDay, FIT_PADDING);
  const maxSpan = fitted.endDay - fitted.startDay;
  let span = view.endDay - view.startDay;
  if (span < minSpanDays) span = minSpanDays;
  if (span > maxSpan) span = maxSpan;
  let startDay = view.startDay;
  let endDay = startDay + span;
  if (startDay < fitted.startDay) {
    startDay = fitted.startDay;
    endDay = startDay + span;
  }
  if (endDay > fitted.endDay) {
    endDay = fitted.endDay;
    startDay = endDay - span;
  }
  return { startDay, endDay };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function yearLabel(year: number): string {
  const era = astronomicalToEra(year);
  return era.era === "BCE" ? `${era.year} BCE` : String(era.year);
}

export function axisTicks(view: TimeView, width: number): { day: number; label: string }[] {
  const span = Math.max(view.endDay - view.startDay, 1);
  const pixelsPerDay = width / span;
  const ticks: { day: number; label: string }[] = [];
  const push = (day: number, label: string) => {
    if (day < view.startDay || day > view.endDay) return;
    const x = ((day - view.startDay) / span) * width;
    const previous = ticks.at(-1);
    if (previous) {
      const previousX = ((previous.day - view.startDay) / span) * width;
      if (x - previousX < 64) return;
    }
    ticks.push({ day, label });
  };

  if (pixelsPerDay >= 36) {
    for (let day = Math.ceil(view.startDay); day <= view.endDay; day += 1) {
      const civil = civilFromDays(day);
      push(day, `${civil.day} ${MONTHS[civil.month - 1]}`);
    }
    return ticks;
  }

  if (pixelsPerDay * 30 >= 40) {
    let cursor = civilFromDays(Math.floor(view.startDay));
    for (let guard = 0; guard < 2400; guard += 1) {
      const day = daysFromCivil(cursor.year, cursor.month, 1);
      if (day > view.endDay) break;
      push(day, `${MONTHS[cursor.month - 1]} ${yearLabel(cursor.year)}`);
      cursor = cursor.month === 12 ? { year: cursor.year + 1, month: 1, day: 1 } : { year: cursor.year, month: cursor.month + 1, day: 1 };
    }
    return ticks;
  }

  const yearPixels = pixelsPerDay * 365;
  const step = yearPixels >= 48 ? 1 : yearPixels * 10 >= 36 ? 10 : yearPixels * 100 >= 28 ? 100 : 500;
  let year = civilFromDays(Math.floor(view.startDay)).year;
  year = Math.floor(year / step) * step;
  for (let guard = 0; guard < 800; guard += 1) {
    const day = daysFromCivil(year, 1, 1);
    if (day > view.endDay) break;
    push(day, yearLabel(year));
    year += step;
  }
  return ticks;
}
