-- The monthly "your month is ready" email: whether it's on, which ended month it last went out for,
-- and a random token for its one-tap stop link.
ALTER TABLE accounts ADD COLUMN reminders_off INTEGER NOT NULL DEFAULT 0;
ALTER TABLE accounts ADD COLUMN reminded_for TEXT;
ALTER TABLE accounts ADD COLUMN email_token TEXT;
