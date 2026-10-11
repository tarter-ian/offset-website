import { createClient, type Client } from "@libsql/client";

// Local dev writes to a SQLite file. In production, set DATABASE_URL (and
// DATABASE_AUTH_TOKEN) to a hosted libSQL database such as Turso.
let client: Client | undefined;
let ready: Promise<unknown> | undefined;

export async function db(): Promise<Client> {
  client ??= createClient({
    url: process.env.DATABASE_URL ?? "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  ready ??= client.execute(
    `CREATE TABLE IF NOT EXISTS waitlist (
       email TEXT PRIMARY KEY,
       created_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`,
  );
  await ready;
  return client;
}
