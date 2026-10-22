"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { eventLabels, eventPlaces, events, labels, placeNames, places } from "@/db/schema";
import type { Certainty, EndpointInput, Era } from "@/lib/dates";
import { eraYearToAstronomical, validateEvent } from "@/lib/dates";
import { requireAdmin } from "@/lib/session";
import { canDeleteNode, slugify, uniqueSlug, wouldCreateCycle } from "@/lib/trees";

export type ActionState = { error: string } | null;

async function guard(): Promise<ActionState> {
  try {
    await requireAdmin();
    return null;
  } catch {
    return { error: "Unauthorized" };
  }
}

function refreshCatalog() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/labels");
  revalidatePath("/admin/places");
  revalidatePath("/admin/events");
}

function readEndpoint(formData: FormData, prefix: string): EndpointInput {
  const monthRaw = String(formData.get(`${prefix}Month`) ?? "").trim();
  const dayRaw = String(formData.get(`${prefix}Day`) ?? "").trim();
  const era = formData.get(`${prefix}Era`) === "BCE" ? "BCE" : "CE";
  const certainty: Certainty = formData.get(`${prefix}Certainty`) === "estimated" ? "estimated" : "certain";
  return {
    year: Number(formData.get(`${prefix}Year`)),
    era,
    month: monthRaw ? Number(monthRaw) : null,
    day: dayRaw ? Number(dayRaw) : null,
    certainty,
  };
}

export async function saveLabel(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await guard();
  if (denied) return denied;
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "") || null;
  const color = String(formData.get("color") ?? "#1d4e89");
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) return { error: "Name is required." };

  const existing = await db.select().from(labels);
  if (id && wouldCreateCycle(existing, id, parentId)) {
    return { error: "That parent would create a cycle." };
  }
  if (parentId && !existing.some((label) => label.id === parentId)) {
    return { error: "Choose a parent that exists." };
  }

  if (id) {
    await db.update(labels).set({ name, parentId, color, description }).where(eq(labels.id, id));
  } else {
    const slug = uniqueSlug(slugify(name), new Set(existing.map((label) => label.slug)));
    const position =
      existing.filter((label) => label.parentId === parentId).reduce((max, label) => Math.max(max, label.position), -1) +
      1;
    await db.insert(labels).values({ name, slug, parentId, color, description, position });
  }
  refreshCatalog();
  redirect("/admin/labels");
}

export async function deleteLabel(id: string): Promise<ActionState> {
  const denied = await guard();
  if (denied) return denied;
  const existing = await db.select().from(labels);
  const links = await db.select().from(eventLabels).where(eq(eventLabels.labelId, id));
  const check = canDeleteNode(
    id,
    existing,
    new Set(links.map((link) => link.labelId)),
  );
  if (!check.ok) return { error: check.reason };
  await db.delete(labels).where(eq(labels.id, id));
  refreshCatalog();
  return null;
}

export async function moveLabel(id: string, direction: "up" | "down"): Promise<ActionState> {
  const denied = await guard();
  if (denied) return denied;
  const existing = await db.select().from(labels);
  const node = existing.find((label) => label.id === id);
  if (!node) return { error: "Label not found." };
  const siblings = existing
    .filter((label) => label.parentId === node.parentId)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  const index = siblings.findIndex((label) => label.id === id);
  const target = index + (direction === "up" ? -1 : 1);
  if (target < 0 || target >= siblings.length) return null;
  const next = [...siblings];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  await db.transaction(async (tx) => {
    for (let position = 0; position < next.length; position += 1) {
      await tx.update(labels).set({ position }).where(eq(labels.id, next[position].id));
    }
  });
  refreshCatalog();
  return null;
}

type NameDraft = {
  name: string;
  startYear: string;
  startEra: Era;
  endYear: string;
  endEra: Era;
};

function parseHistoricalNames(raw: string): { name: string; startYear: number | null; endYear: number | null }[] | { error: string } {
  let drafts: NameDraft[];
  try {
    drafts = JSON.parse(raw) as NameDraft[];
  } catch {
    return { error: "Historical names could not be read." };
  }
  if (!Array.isArray(drafts)) return { error: "Historical names could not be read." };
  const names: { name: string; startYear: number | null; endYear: number | null }[] = [];
  for (const draft of drafts) {
    const name = String(draft.name ?? "").trim();
    if (!name) continue;
    const start = optionalYear(draft.startYear, draft.startEra ?? "CE");
    const end = optionalYear(draft.endYear, draft.endEra ?? "CE");
    if (typeof start === "string") return { error: start };
    if (typeof end === "string") return { error: end };
    if (start != null && end != null && end < start) {
      return { error: `${name} ends before it starts.` };
    }
    names.push({ name, startYear: start, endYear: end });
  }
  return names;
}

function optionalYear(value: string, era: Era): number | null | string {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const year = Number(text);
  if (!Number.isInteger(year) || year < 1) return "Historical name years must be 1 or later.";
  return eraYearToAstronomical(year, era);
}

export async function savePlace(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await guard();
  if (denied) return denied;
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "") || null;
  const latitude = optionalCoordinate(formData.get("latitude"), -90, 90, "Latitude");
  const longitude = optionalCoordinate(formData.get("longitude"), -180, 180, "Longitude");
  if (!name) return { error: "Name is required." };
  if (typeof latitude === "string") return { error: latitude };
  if (typeof longitude === "string") return { error: longitude };
  const parsedNames = parseHistoricalNames(String(formData.get("names") ?? "[]"));
  if ("error" in parsedNames) return parsedNames;

  const existing = await db.select().from(places);
  if (id && wouldCreateCycle(existing, id, parentId)) {
    return { error: "That parent would create a cycle." };
  }
  if (parentId && !existing.some((place) => place.id === parentId)) {
    return { error: "Choose a parent that exists." };
  }

  if (id) {
    await db.transaction(async (tx) => {
      await tx.update(places).set({ name, parentId, latitude, longitude }).where(eq(places.id, id));
      await tx.delete(placeNames).where(eq(placeNames.placeId, id));
      if (parsedNames.length > 0) {
        await tx.insert(placeNames).values(parsedNames.map((entry) => ({ ...entry, placeId: id })));
      }
    });
  } else {
    const slug = uniqueSlug(slugify(name), new Set(existing.map((place) => place.slug)));
    const position =
      existing.filter((place) => place.parentId === parentId).reduce((max, place) => Math.max(max, place.position), -1) +
      1;
    const inserted = await db
      .insert(places)
      .values({ name, slug, parentId, latitude, longitude, position })
      .returning({ id: places.id });
    if (parsedNames.length > 0) {
      await db.insert(placeNames).values(parsedNames.map((entry) => ({ ...entry, placeId: inserted[0].id })));
    }
  }
  refreshCatalog();
  redirect("/admin/places");
}

function optionalCoordinate(
  value: FormDataEntryValue | null,
  min: number,
  max: number,
  label: string,
): number | null | string {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < min || number > max) {
    return `${label} must be between ${min} and ${max}.`;
  }
  return number;
}

export async function deletePlace(id: string): Promise<ActionState> {
  const denied = await guard();
  if (denied) return denied;
  const existing = await db.select().from(places);
  const links = await db.select().from(eventPlaces).where(eq(eventPlaces.placeId, id));
  const check = canDeleteNode(
    id,
    existing,
    new Set(links.map((link) => link.placeId)),
  );
  if (!check.ok) return { error: check.reason };
  await db.delete(places).where(eq(places.id, id));
  refreshCatalog();
  return null;
}

export async function movePlace(id: string, direction: "up" | "down"): Promise<ActionState> {
  const denied = await guard();
  if (denied) return denied;
  const existing = await db.select().from(places);
  const node = existing.find((place) => place.id === id);
  if (!node) return { error: "Place not found." };
  const siblings = existing
    .filter((place) => place.parentId === node.parentId)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  const index = siblings.findIndex((place) => place.id === id);
  const target = index + (direction === "up" ? -1 : 1);
  if (target < 0 || target >= siblings.length) return null;
  const next = [...siblings];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  await db.transaction(async (tx) => {
    for (let position = 0; position < next.length; position += 1) {
      await tx.update(places).set({ position }).where(eq(places.id, next[position].id));
    }
  });
  refreshCatalog();
  return null;
}

export async function saveEvent(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await guard();
  if (denied) return denied;
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "point");
  const result = validateEvent({
    title: String(formData.get("title") ?? ""),
    summary: String(formData.get("summary") ?? "") || null,
    citation: String(formData.get("citation") ?? "") || null,
    start: readEndpoint(formData, "start"),
    end: kind === "range" ? readEndpoint(formData, "end") : null,
    endOpen: kind === "ongoing",
  });
  if (!result.ok) return { error: result.errors.join(" ") };

  const labelIds = [...new Set(formData.getAll("labelIds").map(String).filter(Boolean))];
  const placeIds = [...new Set(formData.getAll("placeIds").map(String).filter(Boolean))];
  const value = result.value;
  const row = {
    title: value.title,
    summary: value.summary,
    citation: value.citation,
    startYear: value.start.year,
    startMonth: value.start.month,
    startDay: value.start.day,
    startCertainty: value.start.certainty,
    endYear: value.end?.year ?? null,
    endMonth: value.end?.month ?? null,
    endDay: value.end?.day ?? null,
    endCertainty: value.end?.certainty ?? null,
    endOpen: value.endOpen,
  };

  try {
    await db.transaction(async (tx) => {
      let eventId = id;
      if (id) {
        await tx.update(events).set(row).where(eq(events.id, id));
        await tx.delete(eventLabels).where(eq(eventLabels.eventId, id));
        await tx.delete(eventPlaces).where(eq(eventPlaces.eventId, id));
      } else {
        const inserted = await tx.insert(events).values(row).returning({ id: events.id });
        eventId = inserted[0].id;
      }
      if (labelIds.length > 0) {
        await tx.insert(eventLabels).values(labelIds.map((labelId) => ({ eventId, labelId })));
      }
      if (placeIds.length > 0) {
        await tx.insert(eventPlaces).values(placeIds.map((placeId) => ({ eventId, placeId })));
      }
    });
  } catch {
    return { error: "Could not save that event." };
  }
  refreshCatalog();
  redirect("/admin/events");
}

export async function deleteEvent(id: string): Promise<ActionState> {
  const denied = await guard();
  if (denied) return denied;
  await db.delete(events).where(eq(events.id, id));
  refreshCatalog();
  redirect("/admin/events");
}
