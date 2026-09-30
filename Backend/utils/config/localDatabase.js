import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { env } from './env.js';
import { parseCsv } from '../csv.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '..');
let database;

function resolveDatabasePath(value) {
  if (value === ':memory:') return value;
  return path.isAbsolute(value) ? value : path.resolve(backendRoot, value);
}

function applyMigrations(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const migrationDir = path.resolve(backendRoot, 'db', 'migrations');
  const files = fs.readdirSync(migrationDir).filter((name) => name.endsWith('.sql')).sort();
  const seen = new Set(db.prepare('SELECT name FROM schema_migrations').all().map((row) => row.name));
  for (const name of files) {
    if (seen.has(name)) continue;
    const sql = fs.readFileSync(path.join(migrationDir, name), 'utf8');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations(name,applied_at) VALUES(?,?)').run(name, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${name} failed: ${error.message}`);
    }
  }
}

export function seedFacilitiesSnapshot(db = getLocalDb(), force = false) {
  const count = Number(db.prepare('SELECT COUNT(*) AS count FROM public_facilities').get()?.count || 0);
  if (count > 0 && !force) return count;
  const csvPath = path.resolve(backendRoot, 'data', 'reference', 'Facilities_Nov2024.csv');
  if (!fs.existsSync(csvPath)) return;
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const insert = db.prepare(`INSERT OR IGNORE INTO public_facilities
    (source_key,name,country,programme,facility_type,seasonality,status,latitude,longitude,source,source_url,source_updated_at,raw_json,synced_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of rows) {
      const key = row['Record ID#'] || row['English Name'];
      if (!key || !row['English Name']) continue;
      insert.run(
        `comnap:${key}`,
        row['English Name'],
        row['Operator (primary)'] || '',
        [row['Operator (primary)'], row['Operator (additional)']].filter(Boolean).join('; '),
        row.Type || 'Facility',
        row.Seasonality || '',
        row.Status || '',
        row['Latitude (DD)'] === '' ? null : Number(row['Latitude (DD)']),
        row['Longitude (DD)'] === '' ? null : Number(row['Longitude (DD)']),
        'COMNAP',
        'https://www.comnap.aq/antarctic-facilities-information',
        'November 2024',
        JSON.stringify(row),
        now,
      );
    }
    db.prepare(`INSERT OR REPLACE INTO data_sources(name,source_url,last_sync,last_status,details)
      VALUES(?,?,?,?,?)`).run(
        'COMNAP Facilities',
        'https://www.comnap.aq/antarctic-facilities-information',
        now,
        'Loaded local reference snapshot',
        'Local November 2024 COMNAP snapshot. Reference data, not a live feed.',
      );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function createLocalDatabase(databaseUrl = env.databaseUrl) {
  const dbPath = resolveDatabasePath(databaseUrl);
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  applyMigrations(db);
  seedFacilitiesSnapshot(db);
  return db;
}

export function initLocalDatabase(databaseUrl = env.databaseUrl) {
  if (!database) database = createLocalDatabase(databaseUrl);
  return database;
}

export function setLocalDatabaseForTest(db) {
  if (database && database !== db) {
    try { database.close(); } catch {}
  }
  database = db;
  return database;
}

export function getLocalDb() {
  return database || initLocalDatabase();
}

export function closeLocalDatabase() {
  if (database) database.close();
  database = undefined;
}
