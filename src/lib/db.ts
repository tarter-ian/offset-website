import { createClient, type Client } from "@libsql/client";

// Local dev writes to a SQLite file. In production, use a hosted libSQL database
// such as Turso: set DATABASE_URL and DATABASE_AUTH_TOKEN, or Turso's own
// TURSO_DATABASE_URL and TURSO_AUTH_TOKEN. Vercel has no disk to write a file to.
let client: Client | undefined;

export class NoDatabaseError extends Error {}
let ready: Promise<unknown> | undefined;

export async function db(): Promise<Client> {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
  if (!url && process.env.VERCEL) throw new NoDatabaseError("No database is connected.");
  client ??= createClient({
    url: url || "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
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
