PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT '',
  operator_type TEXT NOT NULL DEFAULT 'National Antarctic Programme',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('commander','logistics','field')),
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expeditions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'Planning',
  description TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expedition_id INTEGER NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Camp',
  latitude REAL,
  longitude REAL,
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT,
  UNIQUE(expedition_id, name)
);

CREATE TABLE IF NOT EXISTS personnel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expedition_id INTEGER NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,
  external_id TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  team TEXT DEFAULT '',
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Safe',
  last_checkin TEXT,
  contact TEXT DEFAULT '',
  clearance_status TEXT DEFAULT 'Cleared',
  source TEXT NOT NULL DEFAULT 'manual',
  is_synthetic INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_personnel_external
  ON personnel(expedition_id, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS cargo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expedition_id INTEGER NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Medium',
  origin_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  destination_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  current_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Registered',
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'unit',
  assigned_to TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(expedition_id, code)
);

CREATE TABLE IF NOT EXISTS cargo_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cargo_id INTEGER NOT NULL REFERENCES cargo(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  note TEXT DEFAULT '',
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expedition_id INTEGER NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  quantity REAL NOT NULL DEFAULT 0,
  min_quantity REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'units',
  expiry_date TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(expedition_id, sku)
);

CREATE TABLE IF NOT EXISTS inventory_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inventory_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  delta REAL NOT NULL,
  reason TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expedition_id INTEGER NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Ground',
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Operational',
  fuel_percent REAL NOT NULL DEFAULT 100,
  range_km REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(expedition_id, code)
);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expedition_id INTEGER NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Equipment',
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Available',
  serial_number TEXT DEFAULT '',
  assigned_to_personnel_id INTEGER REFERENCES personnel(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  UNIQUE(expedition_id, code)
);

CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expedition_id INTEGER NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Field Emergency',
  severity TEXT NOT NULL DEFAULT 'High',
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  description TEXT DEFAULT '',
  affected_count INTEGER NOT NULL DEFAULT 0,
  assigned_vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  UNIQUE(expedition_id, code)
);

CREATE TABLE IF NOT EXISTS incident_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  note TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expedition_id INTEGER NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS telemetry_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expedition_id INTEGER NOT NULL REFERENCES expeditions(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('personnel','vehicle')),
  entity_id INTEGER NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  altitude_m REAL,
  accuracy_m REAL,
  speed_kph REAL,
  heading REAL,
  source TEXT NOT NULL DEFAULT 'gps',
  recorded_at TEXT NOT NULL,
  received_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_telemetry_entity
  ON telemetry_positions(expedition_id, entity_type, entity_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_time
  ON telemetry_positions(expedition_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS public_facilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  country TEXT DEFAULT '',
  programme TEXT DEFAULT '',
  facility_type TEXT DEFAULT 'Facility',
  seasonality TEXT DEFAULT '',
  status TEXT DEFAULT '',
  latitude REAL,
  longitude REAL,
  source TEXT NOT NULL DEFAULT 'COMNAP',
  source_url TEXT DEFAULT '',
  source_updated_at TEXT DEFAULT '',
  raw_json TEXT DEFAULT '{}',
  synced_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_public_facilities_country
  ON public_facilities(country, name);

CREATE TABLE IF NOT EXISTS facility_weather (
  facility_id INTEGER PRIMARY KEY REFERENCES public_facilities(id) ON DELETE CASCADE,
  temperature_c REAL,
  apparent_temperature_c REAL,
  relative_humidity REAL,
  wind_speed_kph REAL,
  wind_direction_deg REAL,
  wind_gusts_kph REAL,
  surface_pressure_hpa REAL,
  snowfall_mm REAL,
  weather_code INTEGER,
  observed_at TEXT,
  source TEXT NOT NULL DEFAULT 'Open-Meteo',
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS data_sources (
  name TEXT PRIMARY KEY,
  source_url TEXT DEFAULT '',
  last_sync TEXT,
  last_status TEXT DEFAULT 'Never synced',
  details TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_expeditions_org ON expeditions(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_exp ON activity(expedition_id, id DESC);
