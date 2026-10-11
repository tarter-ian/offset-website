import { NextResponse } from "next/server";
import { ReclaimProofRequest } from "@reclaimprotocol/js-sdk";
import { isReclaimService, reclaimConfig, sessionToken } from "@/lib/reclaim";

// Starts a sign-in session. The app secret stays here; the browser gets only the session.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const service = body?.service;
  if (!isReclaimService(service)) return NextResponse.json({ error: "Unknown service." }, { status: 400 });
  const cfg = reclaimConfig(service);
  if (!cfg) return NextResponse.json({ error: "Signing in to this service isn't switched on yet." }, { status: 501 });
  try {
    const request = await ReclaimProofRequest.init(cfg.appId, cfg.secret, cfg.providerId);
    const version = JSON.stringify(request.getProviderVersion());
    return NextResponse.json({ config: request.toJsonString(), version, token: sessionToken(request.getSessionId(), service, version, cfg.secret) });
  } catch {
    return NextResponse.json({ error: "We couldn't start the sign-in. Try again in a minute." }, { status: 502 });
  }
}
