import { db } from "@/db";
import { eventLabels, eventPlaces, events, labels, placeNames, places } from "@/db/schema";
import type { Catalog, CatalogEndpoint } from "@/lib/catalog-types";
import type { Certainty } from "@/lib/dates";

function endpoint(
  year: number,
  month: number | null,
  day: number | null,
  certainty: Certainty,
): CatalogEndpoint {
  return { year, month, day, certainty };
}

export async function getCatalog(): Promise<Catalog> {
  const [labelRows, placeRows, nameRows, eventRows, labelLinks, placeLinks] = await Promise.all([
    db.select().from(labels),
    db.select().from(places),
    db.select().from(placeNames),
    db.select().from(events),
    db.select().from(eventLabels),
    db.select().from(eventPlaces),
  ]);

  return {
    labels: labelRows.map((row) => ({
      id: row.id,
      parentId: row.parentId,
      name: row.name,
      slug: row.slug,
      color: row.color,
      description: row.description,
      position: row.position,
    })),
    places: placeRows.map((row) => ({
      id: row.id,
      parentId: row.parentId,
      name: row.name,
      slug: row.slug,
      latitude: row.latitude,
      longitude: row.longitude,
      position: row.position,
      names: nameRows
        .filter((name) => name.placeId === row.id)
        .map((name) => ({
          id: name.id,
          name: name.name,
          startYear: name.startYear,
          endYear: name.endYear,
        })),
    })),
    events: eventRows.map((row) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      citation: row.citation,
      start: endpoint(row.startYear, row.startMonth, row.startDay, row.startCertainty),
      end:
        row.endYear == null
          ? null
          : endpoint(row.endYear, row.endMonth, row.endDay, row.endCertainty ?? "certain"),
      endOpen: row.endOpen,
      labelIds: labelLinks.filter((link) => link.eventId === row.id).map((link) => link.labelId),
      placeIds: placeLinks.filter((link) => link.eventId === row.id).map((link) => link.placeId),
    })),
  };
}
