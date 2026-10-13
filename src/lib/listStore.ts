import { db, rowsOf } from "./db";
import { owedPaid } from "./payments";
import { badges, hashToken, type Claim, type ListItem } from "./publicList";

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
  source: r.source === "gift" ? "gift" : "plan",
  sourceId: String(r.source_id),
  rows: parse(r.rows, []),
  items: parse(r.items, []),
  createdAt: String(r.created_at),
});

/** Every claim whose gifts have all arrived, from the donations table. */
async function paidOnly(claims: (Claim & { personId: string })[]) {
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
      return { id: String(p.id), name: String(p.name), since: mine.map((c) => c.createdAt).sort()[0] ?? "", badges: badges(mine, now) };
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
  return { id: String(p.id), name: String(p.name), claims: claims.map((c) => ({ items: c.items, createdAt: c.createdAt, source: c.source, paid: paid.has(c.sourceId) })) };
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
}

export async function renamePerson(token: string, name: string): Promise<boolean> {
  const p = await personByToken(token);
  if (!p) return false;
  await (await db()).execute({ sql: "UPDATE list_people SET name = ? WHERE id = ?", args: [name, p.id] });
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
