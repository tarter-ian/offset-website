import { NextResponse } from "next/server";
import { NoDatabaseError } from "@/lib/db";
import { loadGift } from "@/lib/giftStore";
import { recipients } from "@/lib/gifts";
import { addClaim, listedPeople } from "@/lib/listStore";
import { paymentsOn } from "@/lib/payments";
import { cleanName, giftItems, newToken, parsePlanClaim, planItems, planRows, sameRows, TOKEN, type Claim } from "@/lib/publicList";

export const dynamic = "force-dynamic";

/** The public list, as the list page shows it. */
export async function GET() {
  try {
    return NextResponse.json({ people: await listedPeople() }, { headers: { "cache-control": "public, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "Couldn't load the list." }, { status: 503 });
  }
}

/**
 * Asks to be listed for a checkout (as it starts) or a gift received. Answers with
 * the edit token: kept in the browser, and the only way to rename or leave.
 */
export async function POST(req: Request) {
  if (!paymentsOn()) return NextResponse.json({ error: "The list opens when payments do." }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 64_000) return NextResponse.json({ error: "Too big." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body isn't JSON." }, { status: 400 });
  }
  const name = cleanName(body.name);
  if (!name) return NextResponse.json({ error: "Add a name to be listed under." }, { status: 400 });
  const token = typeof body.token === "string" && TOKEN.test(body.token) ? body.token : newToken();
  const now = new Date();
  let claim: Claim;
  try {
    if (body.source === "gift") {
      const found = typeof body.giftId === "string" ? await loadGift(body.giftId) : null;
      if (!found) return NextResponse.json({ error: "Unknown gift." }, { status: 404 });
      const g = found.gift;
      const count = recipients(g).length;
      const n = typeof body.for === "number" && Number.isInteger(body.for) && body.for >= 0 && body.for < count ? body.for : 0;
      const sourceId = count > 1 ? `${g.id}/${n}` : g.id;
      claim = { source: "gift", sourceId, rows: found.owed, items: giftItems(g), createdAt: g.createdAt };
    } else {
      const input = parsePlanClaim(body);
      if (!input) return NextResponse.json({ error: "That plan doesn't add up." }, { status: 400 });
      const rows = planRows(input);
      // The browser's list of gifts must be the one the server works out, or the listing could claim more than was paid.
      if (!rows.length || !sameRows(rows, body.rows)) return NextResponse.json({ error: "The plan changed; try again." }, { status: 409 });
      const createdAt = now.toISOString();
      claim = { source: "plan", sourceId: input.planId, rows, items: planItems(input.lines, input.billing, createdAt, input.pastYears), createdAt };
    }
    await addClaim(token, name, claim, now);
  } catch (e) {
    console.error("list: couldn't save", e instanceof NoDatabaseError ? "no database" : e);
    return NextResponse.json({ error: "Couldn't save." }, { status: 503 });
  }
  return NextResponse.json({ token });
}
