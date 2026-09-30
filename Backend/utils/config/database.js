let d1Database = null;
let localDatabaseOverride = null;
let localModulePromise = null;

function normalizeParams(params) {
  return params.map((value) => (value === undefined ? null : value));
}

async function localModule() {
  if (!localModulePromise) {
    localModulePromise = import('./localDatabase.js');
  }
  return localModulePromise;
}

export function bindD1Database(database) {
  d1Database = database || null;
}

export function usingD1() {
  return Boolean(d1Database);
}

export async function createDatabase(databaseUrl) {
  const local = await localModule();
  return local.createLocalDatabase(databaseUrl);
}

export async function initDatabase(databaseUrl) {
  if (d1Database) return d1Database;
  if (localDatabaseOverride) return localDatabaseOverride;
  const local = await localModule();
  return local.initLocalDatabase(databaseUrl);
}

export function setDatabaseForTest(database) {
  d1Database = null;
  localDatabaseOverride = database;
  return database;
}

export async function getDb() {
  if (d1Database) return d1Database;
  if (localDatabaseOverride) return localDatabaseOverride;
  const local = await localModule();
  return local.getLocalDb();
}

export async function closeDatabase() {
  if (localDatabaseOverride) {
    try {
      localDatabaseOverride.close();
    } catch {}
    localDatabaseOverride = null;
  }
  if (!d1Database) {
    const local = await localModule();
    local.closeLocalDatabase();
  }
}

export async function all(sql, ...params) {
  const values = normalizeParams(params);
  if (d1Database) {
    const statement = d1Database.prepare(sql).bind(...values);
    const result = await statement.all();
    return result.results || [];
  }
  const database = await getDb();
  return database.prepare(sql).all(...values);
}

export async function get(sql, ...params) {
  const values = normalizeParams(params);
  if (d1Database) {
    const statement = d1Database.prepare(sql).bind(...values);
    return (await statement.first()) || undefined;
  }
  const database = await getDb();
  return database.prepare(sql).get(...values);
}

export async function run(sql, ...params) {
  const values = normalizeParams(params);
  if (d1Database) {
    const statement = d1Database.prepare(sql).bind(...values);
    const result = await statement.run();
    return {
      lastInsertRowid: Number(result.meta?.last_row_id || 0),
      changes: Number(result.meta?.changes || 0),
      meta: result.meta || {},
      success: result.success !== false,
    };
  }
  const database = await getDb();
  return database.prepare(sql).run(...values);
}

export async function seedFacilitiesSnapshot(database, force = false) {
  if (d1Database) {
    const row = await get('SELECT COUNT(*) AS count FROM public_facilities');
    return Number(row?.count || 0);
  }
  const local = await localModule();
  const db = database || localDatabaseOverride || local.getLocalDb();
  return local.seedFacilitiesSnapshot(db, force);
}

export async function migrationCount() {
  if (d1Database) {
    try {
      const row = await get('SELECT COUNT(*) AS count FROM d1_migrations');
      return Number(row?.count || 0);
    } catch {
      return 0;
    }
  }
  const row = await get('SELECT COUNT(*) AS count FROM schema_migrations');
  return Number(row?.count || 0);
}