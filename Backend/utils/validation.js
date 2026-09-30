import { get } from './config/database.js';
import { HttpError } from './http.js';

const SAFE_TABLES = new Set([
  'locations',
  'personnel',
  'cargo',
  'inventory_items',
  'vehicles',
  'assets',
  'incidents',
  'planned_routes',
  'geofences',
  'science_records',
]);

export function requireFields(payload, ...fields) {
  for (const field of fields) {
    if (
      payload?.[field] === undefined ||
      payload?.[field] === null ||
      payload?.[field] === ''
    ) {
      throw new HttpError(400, `${field} is required`);
    }
  }
}

export async function ensureExpeditionAccess(user, expeditionId) {
  const row = await get(
    'SELECT * FROM expeditions WHERE id=?',
    Number(expeditionId),
  );
  if (!row) throw new HttpError(404, 'Expedition not found');
  if (Number(row.organization_id) !== Number(user.organization_id)) {
    throw new HttpError(403, 'Expedition access denied');
  }
  return row;
}

export async function ensureEntityInExpedition(
  table,
  id,
  expeditionId,
  label = 'Related resource',
) {
  if (id === null || id === undefined || id === '') return null;
  if (!SAFE_TABLES.has(table)) throw new Error('Unsafe validation table');

  const row = await get(
    `SELECT id,expedition_id FROM ${table} WHERE id=?`,
    Number(id),
  );
  if (!row || Number(row.expedition_id) !== Number(expeditionId)) {
    throw new HttpError(
      400,
      `${label} must belong to the same expedition`,
    );
  }
  return row;
}

export function validateCoordinates(latitude, longitude, label = 'Coordinates') {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    throw new HttpError(400, `${label} are invalid`);
  }
  return [lat, lon];
}
