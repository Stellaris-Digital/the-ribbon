export type HistoricalName = {
  name: string;
  startYear: number | null;
  endYear: number | null;
};

export function placeNameAt(
  place: { name: string; names: HistoricalName[] },
  year: number,
): string {
  const matches = place.names.filter((entry) => {
    const afterStart = entry.startYear == null || year >= entry.startYear;
    const beforeEnd = entry.endYear == null || year <= entry.endYear;
    return afterStart && beforeEnd;
  });
  if (matches.length === 0) return place.name;
  matches.sort(
    (a, b) =>
      (b.startYear ?? Number.NEGATIVE_INFINITY) - (a.startYear ?? Number.NEGATIVE_INFINITY),
  );
  return matches[0].name;
}
