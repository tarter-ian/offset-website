import { accountsOn, normalizeEmail } from "./account";
import { accountFor } from "./accountStore";
import { changesOf, db, rowsOf } from "./db";
import type { ImpactKey } from "./footprint";
import { type Gift, giftCharge, recipients } from "./gifts";
import { EVERY_SLUGS, partnerDonationId, payRows, PLEDGE_EINS, type PayRow } from "./payments";
import { givePledgeDonation, type PledgeDonor, splitName } from "./pledgeApi";
import { type ListItem, PAST, type PlanClaimInput } from "./publicList";
import { harmSplit, planTotals } from "./store";
import type { PaidSession } from "./stripe";

// "pledgeapi" mode on the server: what a plan or gift charges in one Stripe payment,
// the session as it's made, and, once Stripe says it's paid, one Pledge donation per
// charity, each recorded so a failed one can be retried. Server only.

/** A plan's gifts in "pledgeapi" mode, worked out again from what the browser sent, never from its amounts. */
export function planChargeRows(i: PlanClaimInput): PayRow[] {
  const split = harmSplit(planTotals(i.lines, i.ctx, i.billing, i.pastYears), i.ctx, i.billing);
  return payRows(split, i.billing, i.autopay, "pledgeapi");
}

/** The rows autopay charges again each period: the "-repeat" ones. */
export const repeatPart = (rows: PayRow[]) => rows.filter((r) => r.frequency !== "ONCE");

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
  c: { source: "plan" | "gift"; sourceId: string; rows: PayRow[]; amountCents: number; repeat?: { cents: number; interval: "month" | "year" } | null },
  now = new Date(),
): Promise<void> {
  const rows: StoredRow[] = c.rows.map((r) => ({ key: r.key, charity: r.charity, donation: r.donation }));
  await (await db()).execute({
    sql: "INSERT INTO stripe_payments (session_id, source, source_id, rows, amount_cents, status, created_at, repeat_cents, repeat_interval) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?)",
    args: [sessionId, c.source, c.sourceId, JSON.stringify(rows), c.amountCents, now.toISOString(), c.repeat?.cents ?? null, c.repeat?.interval ?? null],
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
  // Autopay: remember what each renewal must charge and give, from what was saved with the session.
  if (s.subscriptionId) {
    const [extra] = rowsOf(await database.execute({ sql: "SELECT source, repeat_cents, repeat_interval FROM stripe_payments WHERE session_id = ?", args: [s.sessionId] }));
    const repeatRows = parseRows(pay.rows).filter((r) => r.key.endsWith("-repeat"));
    if (extra && Number(extra.repeat_cents) > 0 && repeatRows.length) {
      await database.execute({
        sql: `INSERT OR IGNORE INTO stripe_subscriptions (subscription_id, session_id, source, source_id, rows, amount_cents, repeat_interval, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        args: [s.subscriptionId, s.sessionId, String(extra.source), sourceId, JSON.stringify(repeatRows), Number(extra.repeat_cents), String(extra.repeat_interval), now().toISOString()],
      });
    }
  }
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

/**
 * Settles a paid autopay renewal: saves it as its own payment under the invoice id, with the
 * subscription's repeating gifts (their keys made unique to this invoice), then gives them
 * exactly as a first payment is given, including the check that Stripe charged what was
 * saved. A renewal for an unknown or ended subscription gives nothing.
 */
export async function settleRenewal(
  inv: { invoiceId: string; subscriptionId: string; amountCents: number; currency: string; email: string | null; name: string | null; eventId: string },
  o: Parameters<typeof settleSession>[1],
): Promise<Settled> {
  const now = o.now ?? (() => new Date());
  const database = await db();
  const [sub] = rowsOf(
    await database.execute({ sql: "SELECT source, source_id, rows, amount_cents, repeat_interval, status FROM stripe_subscriptions WHERE subscription_id = ?", args: [inv.subscriptionId] }),
  );
  if (!sub || sub.status !== "active") return { status: "unknown", confirmed: 0, failed: 0 };
  const tag = inv.invoiceId.slice(-10);
  const rows = parseRows(sub.rows).map((r) => ({ ...r, key: `${r.key}.${tag}` }));
  await database.execute({
    sql: "INSERT OR IGNORE INTO stripe_payments (session_id, source, source_id, rows, amount_cents, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)",
    args: [inv.invoiceId, String(sub.source), String(sub.source_id), JSON.stringify(rows), Number(sub.amount_cents), now().toISOString()],
  });
  const settled = await settleSession(
    { eventId: inv.eventId, sessionId: inv.invoiceId, paid: true, amountCents: inv.amountCents, currency: inv.currency, referenceId: String(sub.source_id), email: inv.email, name: inv.name },
    o,
  );
  // Once every gift of the renewal is confirmed, a public listing from this plan stays up for the period it paid.
  if (settled.status === "given" && !settled.failed) await extendListing(String(sub.source_id), String(sub.repeat_interval), now());
  return settled;
}

/** Moves a plan's listed dated items on to the end of the period a renewal paid for; lifetime and ended items stay as they are. */
async function extendListing(planId: string, interval: string, paidAt: Date): Promise<void> {
  const database = await db();
  const [claim] = rowsOf(await database.execute({ sql: "SELECT items FROM list_claims WHERE source = 'plan' AND source_id = ?", args: [planId] }));
  if (!claim) return;
  const until = new Date(paidAt);
  if (interval === "year") until.setFullYear(until.getFullYear() + 1);
  else until.setMonth(until.getMonth() + 1);
  let items: ListItem[];
  try {
    items = JSON.parse(String(claim.items)) as ListItem[];
  } catch {
    return;
  }
  if (!Array.isArray(items)) return;
  const next = items.map((i) => (typeof i.until === "string" && i.until !== PAST && Date.parse(i.until) < until.getTime() ? { ...i, until: until.toISOString() } : i));
  await database.execute({ sql: "UPDATE list_claims SET items = ? WHERE source = 'plan' AND source_id = ?", args: [JSON.stringify(next), planId] });
}

/**
 * Whether to email a reminder for an upcoming autopay charge: only for an active
 * subscription, and once per due date. Marks it reminded when it says yes.
 */
export async function claimReminder(subscriptionId: string, dueAt: string | null): Promise<{ amountCents: number; interval: string } | null> {
  const database = await db();
  const [sub] = rowsOf(
    await database.execute({ sql: "SELECT amount_cents, repeat_interval, status, reminded_for FROM stripe_subscriptions WHERE subscription_id = ?", args: [subscriptionId] }),
  );
  if (!sub || sub.status !== "active") return null;
  const due = dueAt ?? "unknown";
  if (sub.reminded_for === due) return null;
  await database.execute({ sql: "UPDATE stripe_subscriptions SET reminded_for = ? WHERE subscription_id = ?", args: [due, subscriptionId] });
  return { amountCents: Number(sub.amount_cents), interval: String(sub.repeat_interval) };
}

/** Marks an autopay subscription ended, when Stripe says it was canceled. */
export async function endSubscription(subscriptionId: string, now = new Date()): Promise<void> {
  await (await db()).execute({
    sql: "UPDATE stripe_subscriptions SET status = 'ended', ended_at = COALESCE(ended_at, ?) WHERE subscription_id = ?",
    args: [now.toISOString(), subscriptionId],
  });
}
