import { CHARITIES } from "./charities";
import { db, rowsOf } from "./db";
import type { ImpactKey } from "./footprint";
import { EVERY_SLUGS } from "./payments";

// The public totals on /ledger, read from the gifts Every.org's webhook confirmed.
// Only charity, month, count and amount: never emails or which plan a gift came from. Server only.

export interface MonthTotal {
  /** "2026-10". */
  month: string;
  slug: string;
  gifts: number;
  /** What people gave, card fees included. */
  usd: number;
  /** What reached the charity after Every.org's card fees. */
  net: number;
}

/** What arrived at the charities and what went to card fees, for one charity or all of them. */
export function arrivedAndFees(rows: MonthTotal[], slug?: string): { arrived: number; fees: number } {
  const mine = slug ? rows.filter((r) => r.slug === slug) : rows;
  const arrived = mine.reduce((sum, r) => sum + r.net, 0);
  const gross = mine.reduce((sum, r) => sum + r.usd, 0);
  return { arrived, fees: Math.max(0, Math.round((gross - arrived) * 100) / 100) };
}

/** Each Every.org charity we pay: its name and the harms it covers, in the store's order. */
export function everyCharities(): { slug: string; name: string; url: string; harms: ImpactKey[] }[] {
  const out: { slug: string; name: string; url: string; harms: ImpactKey[] }[] = [];
  for (const [k, slug] of Object.entries(EVERY_SLUGS) as [ImpactKey, string][]) {
    const found = out.find((c) => c.slug === slug);
    if (found) found.harms.push(k);
    else out.push({ slug, name: CHARITIES[k].name, url: CHARITIES[k].url, harms: [k] });
  }
  return out;
}

/** Confirmed gifts by month and charity, newest month first; empty when the database can't be reached. */
export async function confirmedTotals(): Promise<MonthTotal[]> {
  try {
    const result = await (await db()).execute({
      sql: `SELECT substr(created_at, 1, 7) AS month, nonprofit, COUNT(*) AS gifts, SUM(amount) AS usd, SUM(net_amount) AS net
            FROM donations GROUP BY month, nonprofit ORDER BY month DESC, net DESC`,
    });
    return rowsOf(result).map((r) => ({ month: String(r.month), slug: String(r.nonprofit), gifts: Number(r.gifts) || 0, usd: Number(r.usd) || 0, net: Number(r.net) || 0 }));
  } catch {
    return [];
  }
}
