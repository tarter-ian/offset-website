-- Gifts made through our Every.org donate links, from Every.org's partner webhook.
-- charge_id is unique, so a webhook delivered twice is stored once.
CREATE TABLE IF NOT EXISTS donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  charge_id TEXT NOT NULL UNIQUE,
  partner_donation_id TEXT,
  nonprofit TEXT NOT NULL,
  amount REAL NOT NULL,
  net_amount REAL NOT NULL,
  frequency TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS donations_partner_donation_id ON donations (partner_donation_id);
