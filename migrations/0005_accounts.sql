-- Accounts: an email and what's covered, nothing else. Usage never reaches the server.
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  covered TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- One pending sign-in per email: a 6-digit code and a link token, both stored only as hashes.
CREATE TABLE IF NOT EXISTS sign_ins (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- Signed-in browsers, by a hash of the cookie's token.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  signed_in_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions (account_id);

-- Payments point at the account instead of keeping their own copy of the email,
-- so deleting an account removes the email everywhere.
ALTER TABLE donations ADD COLUMN account_id TEXT;
