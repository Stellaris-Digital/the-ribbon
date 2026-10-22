import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  role: text("role").notNull().default("admin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const certainty = pgEnum("certainty", ["certain", "estimated"]);

export const labels = pgTable(
  "labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id").references((): AnyPgColumn => labels.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    color: text("color").notNull(),
    description: text("description"),
    position: integer("position").notNull().default(0),
  },
  (table) => [uniqueIndex("labels_slug_idx").on(table.slug)],
);

export const places = pgTable(
  "places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentId: uuid("parent_id").references((): AnyPgColumn => places.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    position: integer("position").notNull().default(0),
  },
  (table) => [uniqueIndex("places_slug_idx").on(table.slug)],
);

export const placeNames = pgTable("place_names", {
  id: uuid("id").primaryKey().defaultRandom(),
  placeId: uuid("place_id")
    .notNull()
    .references(() => places.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startYear: integer("start_year"),
  endYear: integer("end_year"),
});

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    summary: text("summary"),
    citation: text("citation"),
    startYear: integer("start_year").notNull(),
    startMonth: smallint("start_month"),
    startDay: smallint("start_day"),
    startCertainty: certainty("start_certainty").notNull(),
    endYear: integer("end_year"),
    endMonth: smallint("end_month"),
    endDay: smallint("end_day"),
    endCertainty: certainty("end_certainty"),
    endOpen: boolean("end_open").notNull().default(false),
    effectiveEndYear: integer("effective_end_year").generatedAlwaysAs(
      sql`CASE WHEN end_open THEN 9999 ELSE COALESCE(end_year, start_year) END`,
    ),
  },
  (table) => [
    index("events_start_year_idx").on(table.startYear),
    index("events_effective_end_year_idx").on(table.effectiveEndYear),
  ],
);

export const eventLabels = pgTable(
  "event_labels",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "restrict" }),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.labelId] })],
);

export const eventPlaces = pgTable(
  "event_places",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "restrict" }),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.placeId] })],
);

export const authSchema = { user, session, account, verification };
