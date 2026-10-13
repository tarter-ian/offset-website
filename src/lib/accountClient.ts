import { accountsOn, mergeCovered } from "./account";
import { type Covered, STORAGE_KEY } from "./covered";

// The browser's side of accounts: who's signed in, and keeping what's covered in
// step between this browser and the account. Only coverage is ever sent.

export interface AccountState {
  signedIn: boolean;
  email?: string;
  covered?: Record<string, Covered>;
  fresh?: boolean;
  reminders?: boolean;
}

export async function fetchAccount(): Promise<AccountState> {
  if (!accountsOn()) return { signedIn: false };
  try {
    const r = await fetch("/api/account", { cache: "no-store" });
    return r.ok ? ((await r.json()) as AccountState) : { signedIn: false };
  } catch {
    return { signedIn: false };
  }
}

/** Sends this browser's covered items to the account; the server only ever adds. */
export async function pushCovered(covered: Record<string, Covered>): Promise<Record<string, Covered> | null> {
  if (!accountsOn() || !Object.keys(covered).length) return null;
  try {
    const r = await fetch("/api/account", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ covered }) });
    return r.ok ? ((await r.json()) as { covered: Record<string, Covered> }).covered : null;
  } catch {
    return null;
  }
}

export function localCovered(): Record<string, Covered> {
  try {
    return (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as { covered?: Record<string, Covered> }).covered ?? {};
  } catch {
    return {};
  }
}

export function setLocalCovered(covered: Record<string, Covered>) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, unknown>;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, covered }));
  } catch {
    // Storage blocked: the account still has it.
  }
}

/** Brings the account's covered items into this browser. Returns what this browser now holds. */
export async function pullCovered(): Promise<Record<string, Covered> | null> {
  const a = await fetchAccount();
  if (!a.signedIn || !a.covered) return null;
  const merged = mergeCovered(localCovered(), a.covered);
  setLocalCovered(merged);
  return merged;
}

async function post(path: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { ok: r.ok, data: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { ok: false, data: { error: "Couldn't reach My Offset. Check your connection and try again." } };
  }
}

export const startSignIn = (email: string) => post("/api/account/start", { email });
export const verifySignIn = (email: string, proof: { code?: string; token?: string }) => post("/api/account/verify", { email, ...proof });
export const signOut = () => post("/api/account/signout", {});

export async function deleteAccount(): Promise<{ deleted?: boolean; emailed?: boolean; error?: string }> {
  try {
    const r = await fetch("/api/account", { method: "DELETE" });
    return (await r.json().catch(() => ({ error: "Something went wrong." }))) as { deleted?: boolean; emailed?: boolean; error?: string };
  } catch {
    return { error: "Couldn't reach My Offset. Check your connection and try again." };
  }
}

/** Turns the monthly "your next month is ready" email on or off. */
export async function setReminders(on: boolean): Promise<boolean> {
  try {
    const r = await fetch("/api/account", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ reminders: on }) });
    return r.ok;
  } catch {
    return false;
  }
}
