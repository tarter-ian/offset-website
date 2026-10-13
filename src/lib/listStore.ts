import { db, rowsOf } from "./db";
import { owedPaid } from "./payments";
import { badges, hashToken, type Claim, type ListItem, withZeroUse } from "./publicList";
import { productById } from "./store";

// Reading and writing the public list. Server only.

export interface ListedPerson {
  id: string;
  name: string;
  /** When their first confirmed checkout or gift was made. */
  since: string;
  badges: ListItem[];
}

const parse = <T,>(v: unknown, fallback: T): T => {
  try {
    return typeof v === "string" ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};

const toClaim = (r: Record<string, unknown>): Claim => ({
  source: r.source === "gift" || r.source === "zero" ? r.source : "plan",
  sourceId: String(r.source_id),
  rows: parse(r.rows, []),
  items: parse(r.items, []),
  createdAt: String(r.created_at),
});

/** The items a person's zero-use claim names, still in the store. */
const zeroOf = (claims: Claim[]) => (claims.find((c) => c.source === "zero")?.items ?? []).map((i) => i.productId).filter((id) => productById(id));

/** Every claim whose gifts have all arrived, from the donations table. A zero-use claim pays for nothing, so it's never one. */
async function paidOnly(all: (Claim & { personId: string })[]) {
  const claims = all.filter((c) => c.source !== "zero");
  if (!claims.length) return [];
  const donations = rowsOf(await (await db()).execute({ sql: "SELECT partner_donation_id, amount FROM donations WHERE partner_donation_id IS NOT NULL" })).map(
    (d) => ({ partnerDonationId: String(d.partner_donation_id), amount: Number(d.amount) || 0 }),
  );
  // A gift for several people lists each of them as "<gift id>/<n>", paid when the gift is.
  return claims.filter((c) => owedPaid(c.sourceId.split("/")[0], c.rows, donations));
}

/** Everyone on the public list with at least one confirmed claim and a badge still current, newest first. */
export async function listedPeople(now = new Date()): Promise<ListedPerson[]> {
  const database = await db();
  const people = rowsOf(await database.execute({ sql: "SELECT id, name FROM list_people" }));
  const claims = rowsOf(await database.execute({ sql: "SELECT person_id, source, source_id, rows, items, created_at FROM list_claims" })).map((r) => ({
    ...toClaim(r),
    personId: String(r.person_id),
  }));
  const paid = await paidOnly(claims);
  return people
    .map((p) => {
      const mine = paid.filter((c) => c.personId === p.id);
      // Zero-use items join only beside a badge that was paid for (see withZeroUse).
      const zero = zeroOf(claims.filter((c) => c.personId === p.id));
      return { id: String(p.id), name: String(p.name), since: mine.map((c) => c.createdAt).sort()[0] ?? "", badges: withZeroUse(badges(mine, now), zero) };
    })
    .filter((p) => p.badges.length)
    .sort((a, b) => b.since.localeCompare(a.since));
}

/** The listing an edit link opens: its name and every claim, paid or still waiting. */
export async function personByToken(token: string) {
  const database = await db();
  const [p] = rowsOf(await database.execute({ sql: "SELECT id, name FROM list_people WHERE token_hash = ?", args: [await hashToken(token)] }));
  if (!p) return null;
  const claims = rowsOf(
    await database.execute({ sql: "SELECT person_id, source, source_id, rows, items, created_at FROM list_claims WHERE person_id = ?", args: [String(p.id)] }),
  ).map((r) => ({ ...toClaim(r), personId: String(p.id) }));
  const paid = new Set((await paidOnly(claims)).map((c) => c.sourceId));
  return {
    id: String(p.id),
    name: String(p.name),
    claims: claims
      .filter((c) => c.source !== "zero")
      .map((c) => ({ items: c.items, createdAt: c.createdAt, source: c.source, paid: paid.has(c.sourceId) })),
    zeroUse: zeroOf(claims),
  };
}

/**
 * Replaces the items a listed person uses none of: names only, checked against the store by
 * the caller (`parseZeroUse`). Kept as the person's one "zero" claim, so leaving deletes it too.
 */
export async function setZeroUse(personId: string, ids: string[], now = new Date()) {
  const database = await db();
  await database.execute({ sql: "DELETE FROM list_claims WHERE source = 'zero' AND source_id = ?", args: [personId] });
  if (!ids.length) return;
  const items: ListItem[] = ids.map((productId) => ({ productId, until: null, zero: true }));
  await database.execute({
    sql: "INSERT INTO list_claims (person_id, source, source_id, rows, items, created_at) VALUES (?, 'zero', ?, '[]', ?, ?)",
    args: [personId, personId, JSON.stringify(items), now.toISOString()],
  });
}

/**
 * Adds a claim to the person the token names, or to a new person under that token.
 * A checkout or gift can be claimed once; claiming it again changes nothing.
 */
export async function addClaim(token: string, name: string, claim: Claim, now = new Date()) {
  const database = await db();
  const hash = await hashToken(token);
  const [found] = rowsOf(await database.execute({ sql: "SELECT id FROM list_people WHERE token_hash = ?", args: [hash] }));
  const id = found ? String(found.id) : crypto.randomUUID();
  if (found) await database.execute({ sql: "UPDATE list_people SET name = ? WHERE id = ?", args: [name, id] });
  else await database.execute({ sql: "INSERT INTO list_people (id, name, token_hash, created_at) VALUES (?, ?, ?, ?)", args: [id, name, hash, now.toISOString()] });
  await database.execute({
    sql: "INSERT OR IGNORE INTO list_claims (person_id, source, source_id, rows, items, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [id, claim.source, claim.sourceId, JSON.stringify(claim.rows), JSON.stringify(claim.items), claim.createdAt],
  });
  return id;
}

/** Changes a listing's name, its zero-use items, or both. */
export async function updatePerson(token: string, change: { name?: string; zeroUse?: string[] }): Promise<boolean> {
  const p = await personByToken(token);
  if (!p) return false;
  if (change.name) await (await db()).execute({ sql: "UPDATE list_people SET name = ? WHERE id = ?", args: [change.name, p.id] });
  if (change.zeroUse) await setZeroUse(p.id, change.zeroUse);
  return true;
}

/** Leaving the list deletes the person and everything they claimed. */
export async function leaveList(token: string): Promise<boolean> {
  const p = await personByToken(token);
  if (!p) return false;
  const database = await db();
  await database.execute({ sql: "DELETE FROM list_claims WHERE person_id = ?", args: [p.id] });
  await database.execute({ sql: "DELETE FROM list_people WHERE id = ?", args: [p.id] });
  return true;
}
