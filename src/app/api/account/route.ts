import { NextResponse } from "next/server";
import { cleanCovered, mergeCovered } from "@/lib/account";
import { sendDeleted, sendSignIn } from "@/lib/accountEmails";
import { currentSession, guarded, json, withSessionCookie } from "@/lib/accountHttp";
import { deleteAccount, saveCovered, startSignIn } from "@/lib/accountStore";

export const dynamic = "force-dynamic";

/** Who's signed in here and what their account covers. */
export async function GET(req: Request) {
  return guarded(req, async () => {
    const s = await currentSession(req);
    if (!s) return json({ signedIn: false });
    return json({ signedIn: true, email: s.account.email, covered: s.account.covered, fresh: s.fresh });
  });
}

/** Adds what this browser has covered to the account. Nothing is ever taken away this way. */
export async function PUT(req: Request) {
  return guarded(req, async () => {
    const s = await currentSession(req);
    if (!s) return json({ error: "Sign in first." }, 401);
    const body = (await req.json().catch(() => null)) as { covered?: unknown } | null;
    const covered = mergeCovered(s.account.covered, cleanCovered(body?.covered));
    await saveCovered(s.account.id, covered);
    return json({ covered });
  });
}

/**
 * Deletes the account. Right away if this browser signed in within the last few
 * minutes; otherwise a fresh sign-in link is emailed first, so a computer left
 * signed in can't be used to do it. Either way the owner is told by email.
 */
export async function DELETE(req: Request) {
  return guarded(req, async () => {
    const s = await currentSession(req);
    if (!s) return json({ error: "Sign in first." }, 401);
    if (!s.fresh) {
      const started = await startSignIn(s.account.email);
      if (started) await sendSignIn(s.account.email, new URL(req.url).origin, started.code, started.token, "delete");
      return json({ emailed: true });
    }
    await deleteAccount(s.account);
    await sendDeleted(s.account.email);
    return withSessionCookie(NextResponse.json({ deleted: true }), null, new URL(req.url).protocol === "https:");
  });
}
