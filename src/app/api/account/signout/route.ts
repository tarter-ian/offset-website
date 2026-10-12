import { NextResponse } from "next/server";
import { currentSession, guarded, withSessionCookie } from "@/lib/accountHttp";
import { endSession } from "@/lib/accountStore";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return guarded(req, async () => {
    const session = await currentSession(req);
    if (session) await endSession(session.tokenHash);
    return withSessionCookie(NextResponse.json({ ok: true }), null, new URL(req.url).protocol === "https:");
  });
}
