import { cleanCovered, FRESH_MINUTES, MAX_ATTEMPTS, newCode, randomHex, RESEND_SECONDS, sha256, SIGN_IN_MINUTES } from "./account";
import type { Covered } from "./covered";
import { db, rowsOf } from "./db";
import { safeEqual } from "./everyWebhook";

// Reading and writing accounts. Server only.

export interface Account {
  id: string;
  email: string;
  covered: Record<string, Covered>;
}

const toAccount = (r: Record<string, unknown>): Account => {
  let covered: unknown = {};
  try {
    covered = JSON.parse(String(r.covered));
  } catch {
    // Keep it empty.
  }
  return { id: String(r.id), email: String(r.email), covered: cleanCovered(covered) };
};

export async function accountByEmail(email: string): Promise<Account | null> {
  const r = rowsOf(await (await db()).execute({ sql: "SELECT id, email, covered FROM accounts WHERE email = ?", args: [email] }))[0];
  return r ? toAccount(r) : null;
}

/** The account for an email, made if there isn't one. */
export async function accountFor(email: string, now = new Date()): Promise<Account> {
  const at = now.toISOString();
  await (await db()).execute({
    sql: "INSERT OR IGNORE INTO accounts (id, email, covered, created_at, updated_at) VALUES (?, ?, '{}', ?, ?)",
    args: [randomHex(12), email, at, at],
  });
  return (await accountByEmail(email))!;
}

/**
 * Starts a sign-in: a new code and link token for this email, kept only as
 * hashes. Returns them to email, or null when one was sent too recently.
 */
export async function startSignIn(email: string, now = new Date()): Promise<{ code: string; token: string } | null> {
  const database = await db();
  const last = rowsOf(await database.execute({ sql: "SELECT sent_at FROM sign_ins WHERE email = ?", args: [email] }))[0];
  if (last && now.getTime() - Date.parse(String(last.sent_at)) < RESEND_SECONDS * 1000) return null;
  const code = newCode();
  const token = randomHex(24);
  await database.execute({
    sql: `INSERT INTO sign_ins (email, code_hash, token_hash, attempts, sent_at, expires_at) VALUES (?, ?, ?, 0, ?, ?)
          ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, token_hash = excluded.token_hash, attempts = 0,
          sent_at = excluded.sent_at, expires_at = excluded.expires_at`,
    args: [email, await sha256(`${email}:${code}`), await sha256(token), now.toISOString(), new Date(now.getTime() + SIGN_IN_MINUTES * 60000).toISOString()],
  });
  return { code, token };
}

/** Checks a code or link token. Each sign-in works once; wrong codes count toward the limit. */
export async function finishSignIn(email: string, proof: { code?: string; token?: string }, now = new Date()): Promise<boolean> {
  const database = await db();
  const row = rowsOf(await database.execute({ sql: "SELECT code_hash, token_hash, attempts, expires_at FROM sign_ins WHERE email = ?", args: [email] }))[0];
  if (!row || Date.parse(String(row.expires_at)) <= now.getTime() || Number(row.attempts) >= MAX_ATTEMPTS) return false;
  const ok = proof.token
    ? await safeEqual(await sha256(proof.token), String(row.token_hash))
    : proof.code
      ? await safeEqual(await sha256(`${email}:${proof.code}`), String(row.code_hash))
      : false;
  if (!ok) {
    await database.execute({ sql: "UPDATE sign_ins SET attempts = attempts + 1 WHERE email = ?", args: [email] });
    return false;
  }
  await database.execute({ sql: "DELETE FROM sign_ins WHERE email = ?", args: [email] });
  return true;
}

/** A new signed-in browser. Returns the token for its cookie; only its hash is stored. */
export async function newSession(accountId: string, now = new Date()): Promise<string> {
  const token = randomHex(32);
  await (await db()).execute({
    sql: "INSERT INTO sessions (token_hash, account_id, signed_in_at) VALUES (?, ?, ?)",
    args: [await sha256(token), accountId, now.toISOString()],
  });
  return token;
}

export interface Session {
  account: Account;
  /** Signed in recently enough to delete the account without another email. */
  fresh: boolean;
  tokenHash: string;
}

export async function sessionFor(token: string | undefined, now = new Date()): Promise<Session | null> {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const tokenHash = await sha256(token);
  const r = rowsOf(
    await (await db()).execute({
      sql: "SELECT a.id, a.email, a.covered, s.signed_in_at FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ?",
      args: [tokenHash],
    }),
  )[0];
  if (!r) return null;
  return { account: toAccount(r), fresh: now.getTime() - Date.parse(String(r.signed_in_at)) < FRESH_MINUTES * 60000, tokenHash };
}

export async function saveCovered(accountId: string, covered: Record<string, Covered>, now = new Date()) {
  await (await db()).execute({
    sql: "UPDATE accounts SET covered = ?, updated_at = ? WHERE id = ?",
    args: [JSON.stringify(cleanCovered(covered)), now.toISOString(), accountId],
  });
}

export async function endSession(tokenHash: string) {
  await (await db()).execute({ sql: "DELETE FROM sessions WHERE token_hash = ?", args: [tokenHash] });
}

/** Deletes an account, every session and pending sign-in for it, and unlinks its payments, which stay on the ledger without a name. */
export async function deleteAccount(account: Account) {
  const database = await db();
  await database.execute({ sql: "DELETE FROM sessions WHERE account_id = ?", args: [account.id] });
  await database.execute({ sql: "DELETE FROM sign_ins WHERE email = ?", args: [account.email] });
  await database.execute({ sql: "UPDATE donations SET account_id = NULL, email = NULL WHERE account_id = ? OR email = ?", args: [account.id, account.email] });
  await database.execute({ sql: "DELETE FROM accounts WHERE id = ?", args: [account.id] });
}
