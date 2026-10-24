import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

type DB = LibSQLDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __baliClient?: Client; __baliDb?: DB };

function getClient(): Client {
  if (!globalForDb.__baliClient) {
    globalForDb.__baliClient = createClient({
      url: process.env.DATABASE_URL || "file:bali-food.db",
      authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
    });
  }
  return globalForDb.__baliClient;
}

export function getDb(): DB {
  if (!globalForDb.__baliDb) {
    globalForDb.__baliDb = drizzle(getClient(), { schema });
  }
  return globalForDb.__baliDb;
}

export function getRawClient(): Client {
  return getClient();
}

export { schema };
