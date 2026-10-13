import { NextResponse } from "next/server";
import { loadGift } from "@/lib/giftStore";

export const dynamic = "force-dynamic";

/**
 * A gift for its card: what it covers, the names and note, and whether every
 * charity's gift has arrived. Only someone with the link's random id can read it.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers = { "cache-control": "private, no-store" };
  try {
    const found = await loadGift(id);
    if (!found) return NextResponse.json({ error: "Unknown gift." }, { status: 404, headers });
    return NextResponse.json({ gift: found.gift, paid: found.paid }, { headers });
  } catch {
    return NextResponse.json({ error: "Couldn't look it up." }, { status: 503, headers });
  }
}
