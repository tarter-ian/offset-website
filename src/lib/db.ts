import { getCloudflareContext } from "@opennextjs/cloudflare";

// On Cloudflare the site uses its D1 database, bound as DB in wrangler.jsonc.
// Elsewhere it uses libSQL: a hosted database such as Turso when DATABASE_URL
// (or TURSO_DATABASE_URL) is set, or a local SQLite file in development.

/** The one call the site makes: run a statement with its arguments. */
export interface Db {
  execute(stmt: { sql: string; args?: (string | number | null)[] }): Promise<unknown>;
}

interface D1 {
  prepare(sql: string): { bind(...args: unknown[]): { run(): Promise<unknown> } };
}

export class NoDatabaseError extends Error {}

let client: Db | undefined;

function d1(): Db | null {
  try {
    const binding = (getCloudflareContext().env as { DB?: D1 }).DB;
    if (!binding) return null;
    return { execute: ({ sql, args = [] }) => binding.prepare(sql).bind(...args).run() };
  } catch {
    return null; // Not running on Cloudflare.
  }
}

async function libsql(): Promise<Db | null> {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
  const onCloudflare = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
  if (!url && (process.env.VERCEL || onCloudflare)) return null;
  // The web client talks to Turso over HTTP and runs anywhere; only a local file needs the Node one.
  const { createClient } = url ? await import("@libsql/client/web") : await import("@libsql/client");
  return createClient({
    url: url || "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
  });
}

export async function db(): Promise<Db> {
  client ??= d1() ?? (await libsql()) ?? undefined;
  if (!client) throw new NoDatabaseError("No database is connected.");
  return client;
}

/** The rows a SELECT returned: D1 puts them in `results`, libSQL in `rows`. */
export function rowsOf(result: unknown): Record<string, unknown>[] {
  const r = result as { results?: unknown; rows?: unknown } | null;
  const rows = r?.results ?? r?.rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

/** How many rows an INSERT, UPDATE or DELETE changed: D1 puts it in `meta.changes`, libSQL in `rowsAffected`. */
export function changesOf(result: unknown): number {
  const r = result as { meta?: { changes?: unknown }; rowsAffected?: unknown } | null;
  const n = r?.meta?.changes ?? r?.rowsAffected;
  return typeof n === "number" ? n : 0;
}
