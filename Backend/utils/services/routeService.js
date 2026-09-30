import { get, run } from '../config/database.js';
import { nowIso } from '../helpers.js';
import {
  ensureEntityInExpedition,
  validateCoordinates,
} from '../validation.js';

export function haversineKm(lat1, lon1, lat2, lon2) {
  const rad = (value) => (value * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) *
      Math.cos(rad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function createPlannedRoute(user, payload) {
  const expeditionId = Number(payload.expedition_id);
  const start = validateCoordinates(
    payload.start_lat,
    payload.start_lon,
    'Route start',
  );
  const end = validateCoordinates(
    payload.end_lat,
    payload.end_lon,
    'Route destination',
  );

  await ensureEntityInExpedition(
    'vehicles',
    payload.vehicle_id,
    expeditionId,
    'Vehicle',
  );
  await ensureEntityInExpedition(
    'personnel',
    payload.personnel_id,
    expeditionId,
    'Team leader',
  );

  const distance = Number(
    payload.distance_km ||
      haversineKm(start[0], start[1], end[0], end[1]).toFixed(2),
  );
  const vehicle = payload.vehicle_id
    ? await get(
        'SELECT * FROM vehicles WHERE id=?',
        Number(payload.vehicle_id),
      )
    : null;
  const speed = vehicle?.type === 'Aircraft' ? 220 : 25;
  const eta = Number(
    payload.eta_minutes || Math.max(1, Math.round((distance / speed) * 60)),
  );
  const fuel = Number(
    payload.fuel_liters ||
      (distance * (vehicle?.type === 'Aircraft' ? 2.6 : 0.6)).toFixed(1),
  );
  const ts = nowIso();

  const result = await run(
    `INSERT INTO planned_routes(
      expedition_id,name,start_lat,start_lon,end_lat,end_lon,waypoints_json,
      distance_km,eta_minutes,fuel_liters,vehicle_id,personnel_id,status,
      risk_summary,created_by,created_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    expeditionId,
    payload.name,
    start[0],
    start[1],
    end[0],
    end[1],
    JSON.stringify(payload.waypoints || []),
    distance,
    eta,
    fuel,
    payload.vehicle_id || null,
    payload.personnel_id || null,
    payload.status || 'Planned',
    payload.risk_summary || '',
    user.id,
    ts,
    ts,
  );

  return get(
    'SELECT * FROM planned_routes WHERE id=?',
    Number(result.lastInsertRowid),
  );
}
