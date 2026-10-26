-- Autopay in "pledgeapi" mode (Ian, 2026-10-25): a Stripe subscription that repeats the
-- monthly or yearly part of a plan, off unless the donor turns it on.

-- What a checkout's autopay part is, saved as the session is made: the cents charged again
-- each period and how often. NULL when the donor left autopay off.
ALTER TABLE stripe_payments ADD COLUMN repeat_cents INTEGER;
ALTER TABLE stripe_payments ADD COLUMN repeat_interval TEXT;
-- When a plan spreads past use over years, the day autopay ends because it's paid off (Ian, 2026-10-26).
ALTER TABLE stripe_payments ADD COLUMN past_until TEXT;

-- One row per autopay subscription, written when its first payment is settled. rows is the
-- JSON list of the repeating gifts ([{key, charity, donation}]); amount_cents what each
-- renewal must charge, checked against Stripe's invoice before anything is given. Each paid
-- renewal is then settled like a session, under the invoice id, in stripe_payments and
-- pledge_api_gifts. reminded_for is the due date of the last reminder email, so a resent
-- event doesn't email twice. past_until: as on stripe_payments; the subscription is set to end
-- then, and the reminder before its last charge says so. status: active, or ended.
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  subscription_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  rows TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  repeat_interval TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  reminded_for TEXT,
  created_at TEXT NOT NULL,
  ended_at TEXT,
  past_until TEXT
);
