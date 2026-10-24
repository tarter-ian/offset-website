// Pledge's REST API (pledge.to), for "pledgeapi" mode: after the donor's one Stripe
// payment, the server makes one donation per charity, in the donor's name.
//
// Checked on Pledge's sandbox (api-staging.pledge.to) on 2026-10-24: Bearer auth,
// GET /v1/organizations?q=<name>, and POST /v1/donations made a donation (answered with
// its id, status "pending"); gifts as small as 3¢ went through. Pledge's API reference
// (developer.pledge.to/api, read by Ian 2026-10-24) lists the create fields: email,
// first_name, last_name (all required), phone_number, amount (decimal string), metadata
// (a free-form string), send_tax_receipt and organization_id. external_id isn't one of
// them. Still unchecked: whether Pledge honours the Idempotency-Key header.

export const PLEDGE_API_LIVE = "https://api.pledge.to";
export const PLEDGE_API_SANDBOX = "https://api-staging.pledge.to";

/** Pledge's API host: PLEDGE_API_HOST when set to an https address (the sandbox, say), else the live API. */
export function pledgeApiHost(env: string | undefined = process.env.PLEDGE_API_HOST): string {
  const v = env?.trim();
  if (!v) return PLEDGE_API_LIVE;
  try {
    const u = new URL(v);
    return u.protocol === "https:" ? u.origin : PLEDGE_API_LIVE;
  } catch {
    return PLEDGE_API_LIVE;
  }
}

/** Who the donation is in the name of: the donor, from Stripe's customer_details. */
export interface PledgeDonor {
  email: string;
  firstName: string;
  lastName: string;
}

/** "Jane Q. Doe" as first name "Jane" and last name "Q. Doe". */
export function splitName(name: string | null | undefined): { firstName: string; lastName: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

/** An HTTP request, built apart from sending it so it can be tested. */
export interface PledgeRequest {
  url: string;
  init: { method: "GET" | "POST"; headers: Record<string, string>; body?: string };
}

const auth = (apiKey: string) => ({ authorization: `Bearer ${apiKey}`, accept: "application/json" });

/**
 * Each charity's name as Pledge lists it, by EIN. Pledge's q= search matches names loosely
 * (Ian's test, 2026-10-24: q=04-3512550 returned 180 unrelated charities), so the lookup
 * searches by name and pickOrgId keeps only the result whose EIN matches.
 */
export const PLEDGE_ORG_NAMES: Record<string, string> = {
  "04-3512550": "Clean Air Task Force",
  "84-1606567": "Colorado Water Trust",
  "13-3500609": "Rainforest Trust",
  "26-2066045": "PCs for People",
};

/** Looks a charity up on Pledge: GET /v1/organizations?q=, a page of {results: [{id, name, ngo_id, ...}]} (seen 2026-10-24). */
export function orgLookupRequest(ein: string, apiKey: string, host: string = pledgeApiHost()): PledgeRequest {
  return { url: `${host}/v1/organizations?${new URLSearchParams({ q: PLEDGE_ORG_NAMES[ein] ?? ein })}`, init: { method: "GET", headers: auth(apiKey) } };
}

const digits = (s: unknown) => (typeof s === "string" || typeof s === "number" ? String(s).replace(/\D/g, "") : "");

/**
 * The id of the organization whose EIN is ours, from the lookup's response. Pledge puts
 * the EIN in `ngo_id` (seen 2026-10-24); `ein` is also accepted. Takes a list under
 * `results` or `data`, or a bare list; only an exact EIN match counts.
 */
export function pickOrgId(body: unknown, ein: string): string | null {
  const b = body as { results?: unknown; data?: unknown } | null;
  const list = Array.isArray(body) ? body : Array.isArray(b?.results) ? b.results : Array.isArray(b?.data) ? b.data : [];
  const want = digits(ein);
  const hit = (list as Record<string, unknown>[]).find((o) => o && (digits(o.ngo_id) === want || digits(o.ein) === want) && want.length === 9);
  const id = hit?.id;
  return typeof id === "string" || typeof id === "number" ? String(id) : null;
}

export interface DonationInput {
  organizationId: string;
  /** Dollars, to the cent. */
  amount: number;
  donor: PledgeDonor;
  planId: string;
  /** The row key of this charity's gift in the checkout: "carbon", "water". */
  gift: string;
  /** Sent as Idempotency-Key, so a retried call can't make a second donation, if Pledge honours it. */
  idempotencyKey: string;
}

/** Creates one donation (checked on the sandbox, 2026-10-24). The amount goes as a decimal string, "12.34". */
export function donationRequest(d: DonationInput, apiKey: string, host: string = pledgeApiHost()): PledgeRequest {
  const body: Record<string, unknown> = {
    organization_id: d.organizationId,
    amount: d.amount.toFixed(2),
    email: d.donor.email,
    // A string: Pledge dropped an object here (sandbox, 2026-10-24).
    metadata: `plan=${d.planId};gift=${d.gift}`,
    // Pledge emails the donor a tax receipt only when asked (help.pledgeling.org, API tax receipts).
    send_tax_receipt: true,
  };
  if (d.donor.firstName) body.first_name = d.donor.firstName;
  if (d.donor.lastName) body.last_name = d.donor.lastName;
  return {
    url: `${host}/v1/donations`,
    init: {
      method: "POST",
      headers: { ...auth(apiKey), "content-type": "application/json", "idempotency-key": d.idempotencyKey },
      body: JSON.stringify(body),
    },
  };
}

/** The new donation's id, from the create call's response (at its top level or under `data`). */
export function donationId(body: unknown): string | null {
  const b = body as { id?: unknown; data?: { id?: unknown } } | null;
  const id = b?.id ?? b?.data?.id;
  return typeof id === "string" || typeof id === "number" ? String(id) : null;
}

/** What one call came back with: kept as it came, so a failure can be read and retried. */
export interface PledgeResult {
  ok: boolean;
  status: number;
  raw: string;
  body: unknown;
}

const MAX_RAW = 16 * 1024;

async function send(r: PledgeRequest, fetcher: typeof fetch): Promise<PledgeResult> {
  try {
    const res = await fetcher(r.url, r.init);
    // Parsed whole, kept short: a lookup's page of 25 charities runs past MAX_RAW (Ian's test, 2026-10-24).
    const text = await res.text();
    const raw = text.slice(0, MAX_RAW);
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      // Not JSON: kept as raw text only.
    }
    return { ok: res.ok, status: res.status, raw, body };
  } catch (e) {
    return { ok: false, status: 0, raw: e instanceof Error ? e.message : "fetch failed", body: null };
  }
}

const orgIds = new Map<string, string>();

/**
 * Makes one donation to the charity with this EIN: finds it on Pledge, then creates the donation.
 * Succeeds only when Pledge answers 2xx with a donation id. Never throws.
 */
export async function givePledgeDonation(
  o: { ein: string; amount: number; donor: PledgeDonor; planId: string; gift: string; idempotencyKey: string },
  apiKey: string,
  host: string = pledgeApiHost(),
  fetcher: typeof fetch = fetch,
): Promise<{ ok: true; id: string; raw: string } | { ok: false; error: string; raw: string }> {
  let organizationId = orgIds.get(`${host} ${o.ein}`) ?? null;
  if (!organizationId) {
    const found = await send(orgLookupRequest(o.ein, apiKey, host), fetcher);
    organizationId = found.ok ? pickOrgId(found.body, o.ein) : null;
    if (!organizationId) return { ok: false, error: found.ok ? `No Pledge organization with EIN ${o.ein}` : `Organization lookup failed (${found.status})`, raw: found.raw };
    orgIds.set(`${host} ${o.ein}`, organizationId);
  }
  const made = await send(donationRequest({ organizationId, amount: o.amount, donor: o.donor, planId: o.planId, gift: o.gift, idempotencyKey: o.idempotencyKey }, apiKey, host), fetcher);
  const id = made.ok ? donationId(made.body) : null;
  return id ? { ok: true, id, raw: made.raw } : { ok: false, error: made.ok ? "No donation id in Pledge's answer" : `Donation failed (${made.status})`, raw: made.raw };
}
