-- The public list: people who chose to be listed, under a name they picked.
-- token_hash is the SHA-256 of the edit link's secret, the only way to change
-- or leave a listing. No email, no amounts.
CREATE TABLE IF NOT EXISTS list_people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

-- What each listed person paid for: a plan checkout or a gift they received.
-- rows are the gifts the checkout asked of each charity, worked out on the
-- server; a claim counts once Every.org's webhook shows every one arrived.
CREATE TABLE IF NOT EXISTS list_claims (
  person_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  rows TEXT NOT NULL,
  items TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (source, source_id)
);
CREATE INDEX IF NOT EXISTS list_claims_person ON list_claims (person_id);
