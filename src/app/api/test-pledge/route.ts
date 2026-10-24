// TEST BRANCH ONLY: never merge. Shows which keys this copy can see (never their values),
// Pledge's raw answer to one organization lookup, and the last gifts the webhook tried.
import { NextResponse } from "next/server";
import { db, rowsOf } from "@/lib/db";
import { orgLookupRequest, pickOrgId, pledgeApiHost } from "@/lib/pledgeApi";
import { PLEDGE_EINS } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function GET() {
  const has = (k: string) => (process.env[k]?.trim() ? "found" : "missing");
  const out: Record<string, unknown> = {
    keys: {
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ? "found (test)" : has("STRIPE_SECRET_KEY"),
      STRIPE_WEBHOOK_SECRET: has("STRIPE_WEBHOOK_SECRET"),
      PLEDGE_API_KEY: has("PLEDGE_API_KEY"),
      PLEDGE_API_HOST: pledgeApiHost(),
    },
  };
  const key = process.env.PLEDGE_API_KEY?.trim();
  if (key) {
    const ein = PLEDGE_EINS.carbon ?? "04-3512550";
    const r = orgLookupRequest(ein, key);
    try {
      const res = await fetch(r.url, r.init);
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text);
      } catch {}
      out.orgLookup = { url: r.url, status: res.status, pickedId: pickOrgId(parsed, ein), body: text.slice(0, 3000) };
    } catch (e) {
      out.orgLookup = { url: r.url, error: String(e) };
    }
  }
  try {
    const d = await db();
    out.recentGifts = rowsOf(
      await d.execute({ sql: "SELECT row_key, charity, amount, status, attempts, pledge_id, error, substr(response, 1, 1500) AS response, updated_at FROM pledge_api_gifts ORDER BY updated_at DESC LIMIT 5" }),
    );
    out.recentPayments = rowsOf(await d.execute({ sql: "SELECT session_id, amount_cents, status, created_at, paid_at FROM stripe_payments ORDER BY created_at DESC LIMIT 5" }));
  } catch (e) {
    out.database = String(e);
  }
  return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
}
