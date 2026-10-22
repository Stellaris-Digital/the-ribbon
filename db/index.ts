import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { ribbonSql?: ReturnType<typeof postgres> };

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  return postgres(url, { max: 10 });
}

export const sqlClient = globalForDb.ribbonSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.ribbonSql = sqlClient;

export const db = drizzle(sqlClient, { schema });
