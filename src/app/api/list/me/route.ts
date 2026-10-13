import { NextResponse } from "next/server";
import { leaveList, personByToken, updatePerson } from "@/lib/listStore";
import { cleanName, parseZeroUse, TOKEN } from "@/lib/publicList";

export const dynamic = "force-dynamic";

const headers = { "cache-control": "private, no-store" };

async function tokenOf(req: Request): Promise<{ token: string; body: Record<string, unknown> } | null> {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    return typeof body.token === "string" && TOKEN.test(body.token) ? { token: body.token, body } : null;
  } catch {
    return null;
  }
}

/** A listing, from its edit token. POST so the token stays out of URLs and logs. */
export async function POST(req: Request) {
  const t = await tokenOf(req);
  if (!t) return NextResponse.json({ error: "Bad link." }, { status: 400, headers });
  try {
    const p = await personByToken(t.token);
    if (!p) return NextResponse.json({ error: "Not on the list." }, { status: 404, headers });
    return NextResponse.json({ name: p.name, claims: p.claims, zeroUse: p.zeroUse }, { headers });
  } catch {
    return NextResponse.json({ error: "Couldn't look it up." }, { status: 503, headers });
  }
}

/** A new name, the items the person now uses none of (names only, never amounts), or both. */
export async function PATCH(req: Request) {
  const t = await tokenOf(req);
  if (!t) return NextResponse.json({ error: "Bad link." }, { status: 400, headers });
  const name = cleanName(t.body.name);
  const zeroUse = t.body.zeroUse === undefined ? undefined : parseZeroUse(t.body.zeroUse);
  if (zeroUse === null) return NextResponse.json({ error: "Unknown item." }, { status: 400, headers });
  if (!name && !zeroUse) return NextResponse.json({ error: "Add a name." }, { status: 400, headers });
  try {
    return (await updatePerson(t.token, { name: name || undefined, zeroUse }))
      ? NextResponse.json({ ok: true }, { headers })
      : NextResponse.json({ error: "Not on the list." }, { status: 404, headers });
  } catch {
    return NextResponse.json({ error: "Couldn't save." }, { status: 503, headers });
  }
}

export async function DELETE(req: Request) {
  const t = await tokenOf(req);
  if (!t) return NextResponse.json({ error: "Bad link." }, { status: 400, headers });
  try {
    return (await leaveList(t.token)) ? NextResponse.json({ ok: true }, { headers }) : NextResponse.json({ error: "Not on the list." }, { status: 404, headers });
  } catch {
    return NextResponse.json({ error: "Couldn't remove you." }, { status: 503, headers });
  }
}
