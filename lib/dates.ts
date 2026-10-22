export type Certainty = "certain" | "estimated";
export type Era = "BCE" | "CE";

export type DateEndpoint = {
  year: number;
  month: number | null;
  day: number | null;
  certainty: Certainty;
};

export type EndpointInput = {
  year: number;
  era: Era;
  month: number | null;
  day: number | null;
  certainty: Certainty;
};

export type StoredEventDate = {
  title: string;
  summary: string | null;
  citation: string | null;
  start: DateEndpoint;
  end: DateEndpoint | null;
  endOpen: boolean;
};

export type EventDateInput = {
  title: string;
  summary: string | null;
  citation: string | null;
  start: EndpointInput;
  end: EndpointInput | null;
  endOpen: boolean;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function eraYearToAstronomical(year: number, era: Era): number {
  return era === "CE" ? year : 1 - year;
}

export function astronomicalToEra(year: number): { year: number; era: Era } {
  if (year > 0) return { year, era: "CE" };
  return { year: 1 - year, era: "BCE" };
}

export function civilFromDays(days: number): { year: number; month: number; day: number } {
  const z = days + 719468;
  const era = Math.floor((z >= 0 ? z : z - 146096) / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  return { year: y + (month <= 2 ? 1 : 0), month, day };
}

export function daysFromCivil(year: number, month: number, day: number): number {
  let y = year;
  y -= month <= 2 ? 1 : 0;
  const era = Math.floor((y >= 0 ? y : y - 399) / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function isLeapYear(year: number): boolean {
  const divisible = (value: number, divisor: number) =>
    Math.floor(value / divisor) * divisor === value;
  return (divisible(year, 4) && !divisible(year, 100)) || divisible(year, 400);
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

export function compareEndpoints(a: DateEndpoint, b: DateEndpoint): number {
  const left = [a.year, a.month ?? 0, a.day ?? 0];
  const right = [b.year, b.month ?? 0, b.day ?? 0];
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function formatEndpoint(endpoint: DateEndpoint): string {
  const { year, era } = astronomicalToEra(endpoint.year);
  const eraSuffix = era === "BCE" ? " BCE" : "";
  let text: string;
  if (endpoint.month && endpoint.day) {
    text = `${endpoint.day} ${MONTHS[endpoint.month - 1]} ${year}${eraSuffix}`;
  } else if (endpoint.month) {
    text = `${MONTHS[endpoint.month - 1]} ${year}${eraSuffix}`;
  } else {
    text = `${year}${eraSuffix}`;
  }
  return endpoint.certainty === "estimated" ? `c. ${text}` : text;
}

export function formatEventDate(event: {
  start: DateEndpoint;
  end: DateEndpoint | null;
  endOpen: boolean;
}): string {
  const start = formatEndpoint(event.start);
  if (event.endOpen) return `${start} – present`;
  if (!event.end) return start;
  return `${start} – ${formatEndpoint(event.end)}`;
}

function endpointError(input: EndpointInput, label: string): string | null {
  if (!Number.isInteger(input.year) || input.year < 1) {
    return `${label} year must be 1 or later.`;
  }
  if (input.month != null && (input.month < 1 || input.month > 12)) {
    return `${label} month is not valid.`;
  }
  if (input.day != null && input.month == null) {
    return `${label} day requires a month.`;
  }
  if (input.day != null && input.month != null) {
    const year = eraYearToAstronomical(input.year, input.era);
    if (input.day < 1 || input.day > daysInMonth(year, input.month)) {
      return `${label} day is not valid.`;
    }
  }
  return null;
}

function toEndpoint(input: EndpointInput): DateEndpoint {
  return {
    year: eraYearToAstronomical(input.year, input.era),
    month: input.month,
    day: input.day,
    certainty: input.certainty,
  };
}

export function validateEvent(
  input: EventDateInput,
): { ok: true; value: StoredEventDate } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push("Title is required.");
  const startError = endpointError(input.start, "Start");
  if (startError) errors.push(startError);
  if (input.endOpen && input.end) errors.push("An ongoing event has no end date.");
  if (input.end) {
    const endError = endpointError(input.end, "End");
    if (endError) errors.push(endError);
  }
  if (errors.length > 0) return { ok: false, errors };

  const start = toEndpoint(input.start);
  const end = input.end ? toEndpoint(input.end) : null;
  if (end && compareEndpoints(end, start) < 0) {
    return { ok: false, errors: ["The end is before the start."] };
  }
  return {
    ok: true,
    value: {
      title: input.title.trim(),
      summary: input.summary?.trim() ? input.summary.trim() : null,
      citation: input.citation?.trim() ? input.citation.trim() : null,
      start,
      end,
      endOpen: input.endOpen,
    },
  };
}

function precision(endpoint: DateEndpoint): "day" | "month" | "year" {
  if (endpoint.day && endpoint.month) return "day";
  if (endpoint.month) return "month";
  return "year";
}

function spanStart(endpoint: DateEndpoint): number {
  return daysFromCivil(endpoint.year, endpoint.month ?? 1, endpoint.day ?? 1);
}

function spanEndExclusive(endpoint: DateEndpoint): number {
  if (endpoint.day && endpoint.month) {
    return daysFromCivil(endpoint.year, endpoint.month, endpoint.day) + 1;
  }
  if (endpoint.month) {
    const nextMonth = endpoint.month === 12 ? 1 : endpoint.month + 1;
    const nextYear = endpoint.month === 12 ? endpoint.year + 1 : endpoint.year;
    return daysFromCivil(nextYear, nextMonth, 1);
  }
  return daysFromCivil(endpoint.year + 1, 1, 1);
}

function todayExclusive(): number {
  const now = new Date();
  return daysFromCivil(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()) + 1;
}

export function eventGeometry(event: {
  start: DateEndpoint;
  end: DateEndpoint | null;
  endOpen: boolean;
}): {
  startDay: number;
  endDay: number;
  tick: boolean;
  startHatched: boolean;
  endHatched: boolean;
} {
  const startDay = spanStart(event.start);
  const endDay = event.endOpen
    ? todayExclusive()
    : event.end
      ? spanEndExclusive(event.end)
      : spanEndExclusive(event.start);
  const tick = !event.end && !event.endOpen && precision(event.start) === "day";
  const coarseOrEstimated = (endpoint: DateEndpoint) =>
    endpoint.certainty === "estimated" || precision(endpoint) !== "day";
  return {
    startDay,
    endDay,
    tick,
    isRange: Boolean(event.end) || event.endOpen,
    startHatched: coarseOrEstimated(event.start),
    endHatched: event.end ? coarseOrEstimated(event.end) : event.endOpen ? false : coarseOrEstimated(event.start),
  };
}

export function endpointToInput(endpoint: DateEndpoint): EndpointInput {
  const { year, era } = astronomicalToEra(endpoint.year);
  return {
    year,
    era,
    month: endpoint.month,
    day: endpoint.day,
    certainty: endpoint.certainty,
  };
}
