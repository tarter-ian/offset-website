import { accountsOn, normalizeEmail } from "./account";
import { accountFor } from "./accountStore";
import { changesOf, db, rowsOf } from "./db";
import type { ImpactKey } from "./footprint";
import { type Gift, giftCharge, recipients } from "./gifts";
import { EVERY_SLUGS, partnerDonationId, payRows, PLEDGE_EINS, type PayRow } from "./payments";
import { givePledgeDonation, type PledgeDonor, splitName } from "./pledgeApi";
import type { PlanClaimInput } from "./publicList";
import { harmSplit, planTotals } from "./store";
import type { PaidSession } from "./stripe";

// "pledgeapi" mode on the server: what a plan or gift charges in one Stripe payment,
// the session as it's made, and, once Stripe says it's paid, one Pledge donation per
// charity, each recorded so a failed one can be retried. Server only.

/** A plan's gifts in "pledgeapi" mode, worked out again from what the browser sent, never from its amounts. */
export function planChargeRows(i: PlanClaimInput): PayRow[] {
  const split = harmSplit(planTotals(i.lines, i.ctx, i.billing, i.pastYears), i.ctx, i.billing);
  return payRows(split, i.billing, false, "pledgeapi");
}

/** A saved gift's gifts in "pledgeapi" mode, from the gift as it's stored. */
export const giftChargeRows = (g: Pick<Gift, "items" | "birthYear" | "to">): PayRow[] =>
  giftCharge(g.items, g.birthYear, recipients(g).length, "pledgeapi").rows;

/** What's kept of each gift with the session: enough to give it, nothing more. */
export interface StoredRow {
  key: string;
  charity: ImpactKey;
  donation: number;
}

/** Saves a session as it's made, with the gifts and the amount it was made for. */
export async function saveSession(
  sessionId: string,
  c: { source: "plan" | "gift"; sourceId: string; rows: PayRow[]; amountCents: number },
  now = new Date(),
): Promise<void> {
  const rows: StoredRow[] = c.rows.map((r) => ({ key: r.key, charity: r.charity, donation: r.donation }));
  await (await db()).execute({
    sql: "INSERT INTO stripe_payments (session_id, source, source_id, rows, amount_cents, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)",
    args: [sessionId, c.source, c.sourceId, JSON.stringify(rows), c.amountCents, now.toISOString()],
  });
}

function parseRows(raw: unknown): StoredRow[] {
  try {
    const list = JSON.parse(String(raw)) as StoredRow[];
    return Array.isArray(list) ? list.filter((r) => typeof r?.key === "string" && typeof r.donation === "number" && r.donation > 0 && !!PLEDGE_EINS[r.charity]) : [];
  } catch {
    return [];
  }
}

/** A call "sending" for longer than this is taken to have died, and may be tried again. */
const STALE_MS = 10 * 60 * 1000;

export interface Settled {
  status: "unpaid" | "unknown" | "mismatch" | "given";
  confirmed: number;
  failed: number;
}

/**
 * Settles a paid session: checks Stripe's total against the one saved, records each
 * charity's gift once (unique on session and row), and gives every one not yet
 * confirmed through Pledge. Run again for the same session, as when Stripe delivers
 * the event again or Ian resends it from Stripe's dashboard, it retries only the
 * gifts still failed. A row is claimed before its call, so two deliveries at once
 * can't both give it. Throws only when the database can't be reached.
 */
export async function settleSession(
  s: PaidSession,
  o: { apiKey: string | undefined; host?: string; fetcher?: typeof fetch; now?: () => Date },
): Promise<Settled> {
  const now = o.now ?? (() => new Date());
  if (!s.paid) return { status: "unpaid", confirmed: 0, failed: 0 };
  const database = await db();
  const [pay] = rowsOf(
    await database.execute({ sql: "SELECT source_id, rows, amount_cents, status FROM stripe_payments WHERE session_id = ?", args: [s.sessionId] }),
  );
  if (!pay) return { status: "unknown", confirmed: 0, failed: 0 };
  if (pay.status === "mismatch" || Number(pay.amount_cents) !== s.amountCents || s.currency.toLowerCase() !== "usd") {
    await database.execute({ sql: "UPDATE stripe_payments SET status = 'mismatch', paid_at = COALESCE(paid_at, ?) WHERE session_id = ?", args: [now().toISOString(), s.sessionId] });
    return { status: "mismatch", confirmed: 0, failed: 0 };
  }
  const sourceId = String(pay.source_id);
  await database.execute({ sql: "UPDATE stripe_payments SET status = 'paid', paid_at = COALESCE(paid_at, ?) WHERE session_id = ?", args: [now().toISOString(), s.sessionId] });
  for (const r of parseRows(pay.rows)) {
    await database.execute({
      sql: `INSERT OR IGNORE INTO pledge_api_gifts (session_id, row_key, partner_donation_id, charity, ein, amount, status, attempts, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'new', 0, ?)`,
      args: [s.sessionId, r.key, partnerDonationId(sourceId, r.key), r.charity, PLEDGE_EINS[r.charity]!, r.donation, now().toISOString()],
    });
  }
  const open = rowsOf(
    await database.execute({
      sql: "SELECT row_key, partner_donation_id, charity, ein, amount FROM pledge_api_gifts WHERE session_id = ? AND status <> 'confirmed'",
      args: [s.sessionId],
    }),
  );
  const { firstName, lastName } = splitName(s.name);
  const donor: PledgeDonor | null = s.email ? { email: s.email, firstName, lastName } : null;
  const email = accountsOn() && s.email ? normalizeEmail(s.email) : null;
  let confirmed = 0;
  let failed = 0;
  for (const g of open) {
    const key = String(g.row_key);
    const at = now();
    const claimed = changesOf(
      await database.execute({
        sql: `UPDATE pledge_api_gifts SET status = 'sending', attempts = attempts + 1, updated_at = ?
              WHERE session_id = ? AND row_key = ? AND (status IN ('new', 'failed') OR (status = 'sending' AND updated_at < ?))`,
        args: [at.toISOString(), s.sessionId, key, new Date(at.getTime() - STALE_MS).toISOString()],
      }),
    );
    if (!claimed) continue;
    const amount = Number(g.amount);
    const result =
      !o.apiKey
        ? { ok: false as const, error: "PLEDGE_API_KEY isn't set", raw: "" }
        : !donor
          ? { ok: false as const, error: "Stripe sent no donor email", raw: "" }
          : await givePledgeDonation(
              { ein: String(g.ein), amount, donor, planId: sourceId, gift: key, idempotencyKey: `${s.sessionId}.${key}` },
              o.apiKey,
              o.host,
              o.fetcher,
            );
    if (result.ok) {
      confirmed++;
      await database.execute({
        sql: "UPDATE pledge_api_gifts SET status = 'confirmed', pledge_id = ?, response = ?, error = NULL, updated_at = ? WHERE session_id = ? AND row_key = ?",
        args: [result.id, result.raw, now().toISOString(), s.sessionId, key],
      });
      // Where checkout, gifts, the list and the ledger look for a confirmed gift. The charity keeps it all: Pledge's fees were paid on top.
      const account = email ? await accountFor(email) : null;
      await database.execute({
        sql: `INSERT OR IGNORE INTO donations (charge_id, partner_donation_id, nonprofit, amount, net_amount, frequency, email, account_id, created_at)
              VALUES (?, ?, ?, ?, ?, 'One-time', NULL, ?, ?)`,
        args: [`pledge:${result.id}`, String(g.partner_donation_id), EVERY_SLUGS[g.charity as ImpactKey] ?? String(g.charity), amount, amount, account?.id ?? null, now().toISOString()],
      });
    } else {
      failed++;
      await database.execute({
        sql: "UPDATE pledge_api_gifts SET status = 'failed', response = ?, error = ?, updated_at = ? WHERE session_id = ? AND row_key = ?",
        args: [result.raw, result.error, now().toISOString(), s.sessionId, key],
      });
    }
  }
  return { status: "given", confirmed, failed };
}
