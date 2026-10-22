import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { db, sqlClient } from "./index";
import { account, eventLabels, eventPlaces, events, labels, placeNames, places, user } from "./schema";
import { eraYearToAstronomical, type Certainty, type Era } from "../lib/dates";

type Endpoint = {
  year: number;
  era: Era;
  month: number | null;
  day: number | null;
  certainty: Certainty;
};

function parts(endpoint: Endpoint | null) {
  if (!endpoint) {
    return { year: null, month: null, day: null, certainty: null };
  }
  return {
    year: eraYearToAstronomical(endpoint.year, endpoint.era),
    month: endpoint.month,
    day: endpoint.day,
    certainty: endpoint.certainty,
  };
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  }
  const existing = await db.select().from(user).where(eq(user.email, email));
  if (existing.length > 0) return;
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(user).values({
    id,
    name: "Admin",
    email,
    emailVerified: true,
    role: "admin",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(account).values({
    id: crypto.randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(password),
    createdAt: now,
    updatedAt: now,
  });
}

async function seedCatalog() {
  const existing = await db.select({ id: labels.id }).from(labels).limit(1);
  if (existing.length > 0) return;

  const labelIds = {
    us: crypto.randomUUID(),
    colonial: crypto.randomUUID(),
    revolution: crypto.randomUUID(),
    civil: crypto.randomUUID(),
    church: crypto.randomUUID(),
    papacy: crypto.randomUUID(),
    councils: crypto.randomUUID(),
  };
  await db.insert(labels).values([
    { id: labelIds.us, name: "United States", slug: "united-states", color: "#1d4e89", position: 0 },
    { id: labelIds.colonial, parentId: labelIds.us, name: "Colonial America", slug: "colonial-america", color: "#0f766e", position: 0 },
    { id: labelIds.revolution, parentId: labelIds.us, name: "Revolution", slug: "revolution", color: "#9a3412", position: 1 },
    { id: labelIds.civil, parentId: labelIds.us, name: "Civil War", slug: "civil-war", color: "#854d0e", position: 2 },
    { id: labelIds.church, name: "Catholic Church", slug: "catholic-church", color: "#5b21b6", position: 1 },
    { id: labelIds.papacy, parentId: labelIds.church, name: "Papacy", slug: "papacy", color: "#6d28d9", position: 0 },
    { id: labelIds.councils, parentId: labelIds.church, name: "Councils", slug: "councils", color: "#0e7490", position: 1 },
  ]);

  const placeIds = {
    europe: crypto.randomUUID(),
    italy: crypto.randomUUID(),
    rome: crypto.randomUUID(),
    turkey: crypto.randomUUID(),
    istanbul: crypto.randomUUID(),
    nicaea: crypto.randomUUID(),
    northAmerica: crypto.randomUUID(),
    unitedStates: crypto.randomUUID(),
    virginia: crypto.randomUUID(),
    pennsylvania: crypto.randomUUID(),
  };
  await db.insert(places).values([
    { id: placeIds.europe, name: "Europe", slug: "europe", position: 0 },
    { id: placeIds.italy, parentId: placeIds.europe, name: "Italy", slug: "italy", position: 0 },
    { id: placeIds.rome, parentId: placeIds.italy, name: "Rome", slug: "rome", latitude: 41.9028, longitude: 12.4964, position: 0 },
    { id: placeIds.turkey, parentId: placeIds.europe, name: "Turkey", slug: "turkey", position: 1 },
    { id: placeIds.istanbul, parentId: placeIds.turkey, name: "Istanbul", slug: "istanbul", latitude: 41.0082, longitude: 28.9784, position: 0 },
    { id: placeIds.nicaea, parentId: placeIds.turkey, name: "Nicaea", slug: "nicaea", latitude: 40.4286, longitude: 29.7211, position: 1 },
    { id: placeIds.northAmerica, name: "North America", slug: "north-america", position: 1 },
    { id: placeIds.unitedStates, parentId: placeIds.northAmerica, name: "United States", slug: "united-states-place", position: 0 },
    { id: placeIds.virginia, parentId: placeIds.unitedStates, name: "Virginia", slug: "virginia", latitude: 37.4316, longitude: -78.6569, position: 0 },
    { id: placeIds.pennsylvania, parentId: placeIds.unitedStates, name: "Pennsylvania", slug: "pennsylvania", latitude: 41.2033, longitude: -77.1945, position: 1 },
  ]);
  await db.insert(placeNames).values([
    { placeId: placeIds.istanbul, name: "Byzantium", endYear: eraYearToAstronomical(329, "CE") },
    {
      placeId: placeIds.istanbul,
      name: "Constantinople",
      startYear: eraYearToAstronomical(330, "CE"),
      endYear: eraYearToAstronomical(1929, "CE"),
    },
  ]);

  const catalogEvents: {
    title: string;
    summary: string | null;
    citation: string | null;
    start: Endpoint;
    end: Endpoint | null;
    endOpen: boolean;
    labelIds: string[];
    placeIds: string[];
  }[] = [
    {
      title: "Traditional founding of Rome",
      summary: "The traditional date for the founding of the city.",
      citation: "Traditional Roman chronology",
      start: { year: 753, era: "BCE", month: null, day: null, certainty: "estimated" },
      end: null,
      endOpen: false,
      labelIds: [],
      placeIds: [placeIds.rome],
    },
    {
      title: "Edict of Milan",
      summary: "Constantine and Licinius agree to tolerate Christianity.",
      citation: "Lactantius, On the Deaths of the Persecutors",
      start: { year: 313, era: "CE", month: null, day: null, certainty: "certain" },
      end: null,
      endOpen: false,
      labelIds: [labelIds.church],
      placeIds: [placeIds.istanbul],
    },
    {
      title: "First Council of Nicaea",
      summary: "The council produces the Nicene Creed.",
      citation: "Council of Nicaea",
      start: { year: 325, era: "CE", month: null, day: null, certainty: "certain" },
      end: null,
      endOpen: false,
      labelIds: [labelIds.councils],
      placeIds: [placeIds.nicaea],
    },
    {
      title: "Great Schism",
      summary: "Mutual excommunications divide the churches of Rome and Constantinople.",
      citation: "1054 legation to Constantinople",
      start: { year: 1054, era: "CE", month: null, day: null, certainty: "certain" },
      end: null,
      endOpen: false,
      labelIds: [labelIds.church],
      placeIds: [placeIds.rome, placeIds.istanbul],
    },
    {
      title: "Council of Trent",
      summary: "The council responds to the Reformation.",
      citation: "Council of Trent",
      start: { year: 1545, era: "CE", month: null, day: null, certainty: "certain" },
      end: { year: 1563, era: "CE", month: null, day: null, certainty: "certain" },
      endOpen: false,
      labelIds: [labelIds.councils],
      placeIds: [placeIds.italy],
    },
    {
      title: "Jamestown settled",
      summary: "The English settlement at Jamestown begins.",
      citation: "Virginia Company records",
      start: { year: 1607, era: "CE", month: 5, day: 14, certainty: "certain" },
      end: null,
      endOpen: false,
      labelIds: [labelIds.colonial],
      placeIds: [placeIds.virginia],
    },
    {
      title: "Declaration of Independence",
      summary: "The Continental Congress adopts the Declaration.",
      citation: "National Archives",
      start: { year: 1776, era: "CE", month: 7, day: 4, certainty: "certain" },
      end: null,
      endOpen: false,
      labelIds: [labelIds.revolution],
      placeIds: [placeIds.pennsylvania],
    },
    {
      title: "Constitution signed",
      summary: "Delegates sign the United States Constitution.",
      citation: "National Archives",
      start: { year: 1787, era: "CE", month: 9, day: 17, certainty: "certain" },
      end: null,
      endOpen: false,
      labelIds: [labelIds.us],
      placeIds: [placeIds.pennsylvania],
    },
    {
      title: "American Civil War",
      summary: "War between the Union and the Confederacy.",
      citation: "Fort Sumter to Appomattox",
      start: { year: 1861, era: "CE", month: 4, day: 12, certainty: "certain" },
      end: { year: 1865, era: "CE", month: 4, day: 9, certainty: "certain" },
      endOpen: false,
      labelIds: [labelIds.civil],
      placeIds: [placeIds.unitedStates],
    },
    {
      title: "First Vatican Council",
      summary: "The council defines papal infallibility.",
      citation: "First Vatican Council",
      start: { year: 1869, era: "CE", month: 12, day: 8, certainty: "certain" },
      end: { year: 1870, era: "CE", month: 10, day: 20, certainty: "certain" },
      endOpen: false,
      labelIds: [labelIds.councils],
      placeIds: [placeIds.rome],
    },
    {
      title: "Second Vatican Council",
      summary: "The council renews the liturgy and the church's relationship to the modern world.",
      citation: "Second Vatican Council",
      start: { year: 1962, era: "CE", month: 10, day: 11, certainty: "certain" },
      end: { year: 1965, era: "CE", month: 12, day: 8, certainty: "certain" },
      endOpen: false,
      labelIds: [labelIds.councils],
      placeIds: [placeIds.rome],
    },
    {
      title: "Pontificate of Francis",
      summary: "Jorge Mario Bergoglio is elected pope.",
      citation: "Vatican",
      start: { year: 2013, era: "CE", month: 3, day: 13, certainty: "certain" },
      end: null,
      endOpen: true,
      labelIds: [labelIds.papacy],
      placeIds: [placeIds.rome],
    },
  ];

  for (const event of catalogEvents) {
    const start = parts(event.start);
    const end = parts(event.end);
    const inserted = await db
      .insert(events)
      .values({
        title: event.title,
        summary: event.summary,
        citation: event.citation,
        startYear: start.year!,
        startMonth: start.month,
        startDay: start.day,
        startCertainty: start.certainty!,
        endYear: end.year,
        endMonth: end.month,
        endDay: end.day,
        endCertainty: end.certainty,
        endOpen: event.endOpen,
      })
      .returning({ id: events.id });
    if (event.labelIds.length > 0) {
      await db.insert(eventLabels).values(event.labelIds.map((labelId) => ({ eventId: inserted[0].id, labelId })));
    }
    if (event.placeIds.length > 0) {
      await db.insert(eventPlaces).values(event.placeIds.map((placeId) => ({ eventId: inserted[0].id, placeId })));
    }
  }
}

async function main() {
  await seedAdmin();
  await seedCatalog();
  await sqlClient.end();
  console.log("Seed complete.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
