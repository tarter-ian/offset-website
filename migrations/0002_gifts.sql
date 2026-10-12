-- Offsets one person pays for on behalf of someone else. The id is the gift's
-- random checkout id, so its Every.org gifts are the donations whose
-- partner_donation_id starts with "<id>.". Names and the note are what the giver
-- typed for the gift card, shown only to whoever has the link.
CREATE TABLE IF NOT EXISTS gifts (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  span TEXT NOT NULL,
  from_name TEXT NOT NULL,
  to_name TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL
);
