-- "pledgeapi" mode: the donor pays once through Stripe Checkout, then the server
-- makes one Pledge donation per charity through Pledge's API.

-- One row per Stripe Checkout Session, written as the session is made. session_id is
-- the primary key, so a webhook delivered twice finds the same row. rows is the JSON
-- list of gifts worked out on the server ([{key, charity, donation}]), and
-- amount_cents what Stripe was asked to charge; the webhook checks Stripe's total
-- against it. status: open, paid, or mismatch (paid a different amount; nothing given).
CREATE TABLE IF NOT EXISTS stripe_payments (
  session_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  rows TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS stripe_payments_source ON stripe_payments (source_id);

-- One row per charity's Pledge donation from a paid session, one per (session, row key).
-- status: new, sending (a call is under way), confirmed (Pledge answered with a
-- donation id), or failed (to be retried; see api/stripe/webhook). response keeps
-- Pledge's raw answer to the last call; error says what went wrong in plain words.
-- A confirmed row is also written to donations as "<plan or gift id>.<row key>",
-- where checkout, gifts, the public list and the ledger already look.
CREATE TABLE IF NOT EXISTS pledge_api_gifts (
  session_id TEXT NOT NULL,
  row_key TEXT NOT NULL,
  partner_donation_id TEXT NOT NULL,
  charity TEXT NOT NULL,
  ein TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  attempts INTEGER NOT NULL DEFAULT 0,
  pledge_id TEXT,
  response TEXT,
  error TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (session_id, row_key)
);
CREATE INDEX IF NOT EXISTS pledge_api_gifts_status ON pledge_api_gifts (status);
