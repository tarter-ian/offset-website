import { NextResponse } from "next/server";
import { db, NoDatabaseError } from "@/lib/db";
import { parseGift } from "@/lib/gifts";
import { paymentsOn } from "@/lib/payments";

export const dynamic = "force-dynamic";

/** Saves a gift as the giver starts paying for it. A gift id is saved once; later posts with it change nothing. */
export async function POST(req: Request) {
  if (!paymentsOn()) return NextResponse.json({ error: "Gifts open when payments do." }, { status: 403 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body isn't JSON." }, { status: 400 });
  }
  const parsed = parseGift(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const g = parsed.gift;
  try {
    await (await db()).execute({
      sql: "INSERT OR IGNORE INTO gifts (id, product_id, span, from_name, to_name, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [g.id, g.productId, g.span, g.from, g.to, g.note, g.createdAt],
    });
  } catch (e) {
    console.error("gifts: couldn't save", e instanceof NoDatabaseError ? "no database" : e);
    return NextResponse.json({ error: "Couldn't save the gift." }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
