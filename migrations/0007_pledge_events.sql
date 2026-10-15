-- Webhooks from Pledge (pledge.to), kept as they arrived, with their signature checked first.
-- Pledge doesn't document the payload, so nothing is read out of it yet: once a real one
-- arrives, the fields worth keeping can be matched to plans and gifts from here.
CREATE TABLE IF NOT EXISTS pledge_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  body TEXT NOT NULL,
  received_at TEXT NOT NULL
);
