import { NextResponse } from "next/server";
import { verifyProof, type Proof, type ProviderVersionInfo } from "@reclaimprotocol/js-sdk";
import { checkSessionToken, isReclaimService, RECLAIM_SERVICES, reclaimAiPlan, reclaimConfig, reclaimEvents } from "@/lib/reclaim";

// Checks a proof from a sign-in we started and returns the activity in it. Nothing is stored.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const service = body?.service;
  if (!isReclaimService(service)) return NextResponse.json({ error: "Unknown service." }, { status: 400 });
  const cfg = reclaimConfig(service);
  if (!cfg) return NextResponse.json({ error: "Signing in to this service isn't switched on yet." }, { status: 501 });
  const proofs: Proof[] = (Array.isArray(body?.proofs) ? body.proofs : [body?.proofs]).filter(Boolean);
  const token = typeof body?.token === "string" ? body.token : "";
  const version = typeof body?.version === "string" ? body.version : "";
  let providerVersion: ProviderVersionInfo;
  try {
    providerVersion = JSON.parse(version);
  } catch {
    return NextResponse.json({ error: "That sign-in didn't start here." }, { status: 400 });
  }
  if (providerVersion?.providerId !== cfg.providerId) return NextResponse.json({ error: "That sign-in didn't start here." }, { status: 400 });
  if (!proofs.length) return NextResponse.json({ error: "No data came back from the sign-in." }, { status: 400 });
  try {
    const { isVerified, data, publicData } = await verifyProof(proofs, providerVersion);
    if (!isVerified) return NextResponse.json({ error: "We couldn't verify that sign-in." }, { status: 400 });
    const ok = data.every((d) => checkSessionToken(token, String(d.context.reclaimSessionId ?? ""), service, version, cfg.secret));
    if (!ok) return NextResponse.json({ error: "That sign-in didn't start here." }, { status: 400 });
    if (RECLAIM_SERVICES[service].kind === "ai") {
      const plan = data.map((d, i) => reclaimAiPlan(d.extractedParameters ?? {}, publicData[i])).find(Boolean);
      return plan ? NextResponse.json(plan) : NextResponse.json({ error: "We couldn't see which plan you're on." }, { status: 422 });
    }
    return NextResponse.json({ events: data.flatMap((d, i) => reclaimEvents(service, d.extractedParameters ?? {}, publicData[i])) });
  } catch {
    return NextResponse.json({ error: "We couldn't verify that sign-in." }, { status: 502 });
  }
}
