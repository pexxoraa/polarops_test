import { all } from '../config/database.js';

const cutoffIso = (hours) =>
  new Date(Date.now() - hours * 3600000).toISOString();

export async function synthesizedAlerts(expeditionId) {
  const id = Number(expeditionId);
  const items = [];

  for (const row of await all(
    `SELECT id,name,status,last_checkin FROM personnel
     WHERE expedition_id=?
       AND (
         status IN ('Overdue','Check-in due','Unknown')
         OR (last_checkin IS NOT NULL AND last_checkin < ?)
       )`,
    id,
    cutoffIso(12),
  )) {
    items.push({
      id: 'personnel:' + row.id,
      source: 'Personnel',
      severity: 'Warning',
      status: 'Open',
      title: row.name + ' check-in requires attention',
      detail: row.last_checkin
        ? 'Last check-in ' + row.last_checkin
        : 'No check-in recorded',
      entity_type: 'personnel',
      entity_id: row.id,
      synthetic: true,
    });
  }

  for (const row of await all(
    `SELECT * FROM inventory_items
     WHERE expedition_id=? AND quantity < min_quantity`,
    id,
  )) {
    items.push({
      id: 'inventory:' + row.id,
      source: 'Inventory',
      severity: Number(row.quantity) <= 0 ? 'Critical' : 'Warning',
      status: 'Open',
      title: row.name + ' below safety stock',
      detail:
        row.quantity +
        ' ' +
        row.unit +
        ' available; minimum ' +
        row.min_quantity,
      entity_type: 'inventory',
      entity_id: row.id,
      synthetic: true,
    });
  }

  for (const row of await all(
    `SELECT * FROM vehicles
     WHERE expedition_id=?
       AND (fuel_percent < 30 OR status!='Operational')`,
    id,
  )) {
    items.push({
      id: 'vehicle:' + row.id,
      source: 'Vehicle',
      severity: Number(row.fuel_percent) < 15 ? 'Critical' : 'Warning',
      status: 'Open',
      title: row.code + ' requires attention',
      detail: row.status + '; fuel ' + row.fuel_percent + '%',
      entity_type: 'vehicle',
      entity_id: row.id,
      synthetic: true,
    });
  }

  for (const row of await all(
    `SELECT * FROM comms_checkins
     WHERE expedition_id=?
       AND status!='Completed'
       AND expected_at < ?`,
    id,
    new Date().toISOString(),
  )) {
    items.push({
      id: 'comms:' + row.id,
      source: 'Communications',
      severity: 'Warning',
      status: 'Open',
      title: row.team_name + ' check-in overdue',
      detail: row.channel + '; expected ' + row.expected_at,
      entity_type: 'communication',
      entity_id: row.id,
      synthetic: true,
    });
  }

  for (const row of await all(
    `SELECT * FROM incidents
     WHERE expedition_id=? AND status!='Resolved'`,
    id,
  )) {
    items.push({
      id: 'incident:' + row.id,
      source: 'Incident',
      severity: row.severity || 'Critical',
      status: 'Open',
      title: row.title,
      detail: row.description || row.type,
      entity_type: 'incident',
      entity_id: row.id,
      synthetic: true,
    });
  }

  return items;
}

export async function getUnifiedAlerts(expeditionId) {
  const manual = await all(
    `SELECT * FROM ops_alerts
     WHERE expedition_id=?
     ORDER BY CASE severity
       WHEN 'Critical' THEN 0
       WHEN 'High' THEN 1
       WHEN 'Warning' THEN 2
       ELSE 3
     END, created_at DESC`,
    Number(expeditionId),
  );
  return [...(await synthesizedAlerts(expeditionId)), ...manual];
}
