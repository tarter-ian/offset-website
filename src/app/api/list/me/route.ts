import { NextResponse } from "next/server";
import { leaveList, personByToken, renamePerson } from "@/lib/listStore";
import { cleanName, TOKEN } from "@/lib/publicList";

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
    return NextResponse.json({ name: p.name, claims: p.claims }, { headers });
  } catch {
    return NextResponse.json({ error: "Couldn't look it up." }, { status: 503, headers });
  }
}

export async function PATCH(req: Request) {
  const t = await tokenOf(req);
  const name = cleanName(t?.body.name);
  if (!t || !name) return NextResponse.json({ error: "Add a name." }, { status: 400, headers });
  try {
    return (await renamePerson(t.token, name)) ? NextResponse.json({ ok: true }, { headers }) : NextResponse.json({ error: "Not on the list." }, { status: 404, headers });
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
