-- DLD Transactions (historical data from Dubai Pulse / DXB Interact)
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_date TEXT,
  trans_group TEXT,
  procedure_name TEXT,
  property_type TEXT,
  property_sub_type TEXT,
  area_name TEXT,
  building_name TEXT,
  project_name TEXT,
  actual_worth REAL,
  meter_sale_price REAL,
  property_size_sqm REAL,
  rooms TEXT,
  nearest_landmark TEXT,
  nearest_metro TEXT,
  nearest_mall TEXT
);

CREATE INDEX IF NOT EXISTS idx_txn_area ON transactions(area_name);
CREATE INDEX IF NOT EXISTS idx_txn_type ON transactions(property_type);
CREATE INDEX IF NOT EXISTS idx_txn_date ON transactions(instance_date);
CREATE INDEX IF NOT EXISTS idx_txn_rooms ON transactions(rooms);
CREATE INDEX IF NOT EXISTS idx_txn_area_type_rooms ON transactions(area_name, property_type, rooms);

-- PropertyFinder Listings (current market data)
CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id TEXT UNIQUE,
  title TEXT,
  price REAL,
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  size_sqft REAL,
  area TEXT,
  building_name TEXT,
  furnishing TEXT,
  listing_url TEXT,
  agent_name TEXT,
  description TEXT,
  amenities TEXT,
  latitude REAL,
  longitude REAL,
  listed_date TEXT
);

CREATE INDEX IF NOT EXISTS idx_lst_area ON listings(area);
CREATE INDEX IF NOT EXISTS idx_lst_type ON listings(property_type);
CREATE INDEX IF NOT EXISTS idx_lst_beds ON listings(bedrooms);
CREATE INDEX IF NOT EXISTS idx_lst_price ON listings(price);
CREATE INDEX IF NOT EXISTS idx_lst_area_type_beds ON listings(area, property_type, bedrooms);

-- Area name normalization mapping
CREATE TABLE IF NOT EXISTS area_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_name TEXT NOT NULL,
  alias TEXT NOT NULL UNIQUE,
  source TEXT
);

CREATE INDEX IF NOT EXISTS idx_alias_name ON area_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_alias_canonical ON area_aliases(canonical_name);

-- Precomputed area statistics for fast lookups
CREATE TABLE IF NOT EXISTS area_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area_name TEXT,
  property_type TEXT,
  bedrooms TEXT,
  avg_price_sqft REAL,
  median_price REAL,
  avg_price REAL,
  min_price REAL,
  max_price REAL,
  transaction_count INTEGER,
  period TEXT,
  last_updated TEXT
);

CREATE INDEX IF NOT EXISTS idx_stats_area ON area_stats(area_name, property_type, bedrooms);
