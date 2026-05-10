export const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS Province (
  province_id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS City (
  city_id TEXT PRIMARY KEY,
  province_id TEXT REFERENCES Province(province_id),
  name TEXT NOT NULL,
  visit_state TEXT NOT NULL DEFAULT 'unrecorded',
  summary TEXT,
  cover_asset_id TEXT
);

CREATE TABLE IF NOT EXISTS Trip (
  trip_id TEXT PRIMARY KEY,
  city_id TEXT REFERENCES City(city_id),
  title TEXT NOT NULL,
  date_start TEXT,
  date_end TEXT,
  companions TEXT,
  route TEXT,
  cost_total REAL,
  cover_asset_id TEXT,
  content TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS POI (
  poi_id TEXT PRIMARY KEY,
  city_id TEXT REFERENCES City(city_id),
  name TEXT NOT NULL,
  lng REAL,
  lat REAL,
  gcj02_lng REAL,
  gcj02_lat REAL,
  category TEXT,
  summary TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS Asset (
  asset_id TEXT PRIMARY KEY,
  type TEXT,
  original_filename TEXT,
  mime TEXT,
  size INTEGER,
  sha256 TEXT UNIQUE,
  local_path TEXT,
  remote_url TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS Trip_POI (
  trip_id TEXT REFERENCES Trip(trip_id) ON DELETE CASCADE,
  poi_id TEXT REFERENCES POI(poi_id) ON DELETE CASCADE,
  sort_order INTEGER,
  PRIMARY KEY (trip_id, poi_id)
);

CREATE TABLE IF NOT EXISTS Tag (
  entity_type TEXT,
  entity_id TEXT,
  name TEXT,
  PRIMARY KEY (entity_type, entity_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tag_entity ON Tag(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_city_province ON City(province_id);
CREATE INDEX IF NOT EXISTS idx_trip_city ON Trip(city_id);
CREATE INDEX IF NOT EXISTS idx_poi_city ON POI(city_id);

CREATE TABLE IF NOT EXISTS CostBreakdown (
  trip_id TEXT REFERENCES Trip(trip_id) ON DELETE CASCADE,
  category TEXT,
  amount REAL,
  UNIQUE(trip_id, category)
);
`;
