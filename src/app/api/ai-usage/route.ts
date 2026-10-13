import { NextResponse } from "next/server";
import { API_PROVIDERS, fetchApiUsage, UsageApiError, type ApiProvider } from "@/lib/ai/usageApi";

// Reads usage totals with a key the person pastes in. The key is used for this
// request only: never stored, logged or sent anywhere but the provider.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const provider = body?.provider as ApiProvider;
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!(provider in API_PROVIDERS) || !key || key.length > 500) {
    return NextResponse.json({ error: "Choose a provider and paste a key." }, { status: 400 });
  }
  try {
    return NextResponse.json(await fetchApiUsage(provider, key));
  } catch (e) {
    const status = e instanceof UsageApiError ? e.status : 502;
    const error = e instanceof UsageApiError ? e.message : "I couldn't reach the provider. Try again in a minute.";
    return NextResponse.json({ error }, { status });
  }
}
