-- Gifts can cover several items, each for some years or for life, priced for the
-- recipient's age. items is a JSON list of {productId, span}; product_id and span
-- keep the first item for rows written before this.
ALTER TABLE gifts ADD COLUMN items TEXT;
ALTER TABLE gifts ADD COLUMN birth_year INTEGER;
