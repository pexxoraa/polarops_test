import { all, get } from '../config/database.js';
import { getUnifiedAlerts } from './alertService.js';

async function scalar(sql, id) {
  const row = await get(sql, Number(id));
  return Number(row?.value || 0);
}

export async function getDashboard(expeditionId) {
  const id = Number(expeditionId);
  const vehicleRows = await all(
    'SELECT * FROM vehicles WHERE expedition_id=? ORDER BY code',
    id,
  );
  const alerts = await getUnifiedAlerts(id);

  return {
    personnel: {
      total: await scalar(
        'SELECT COUNT(*) value FROM personnel WHERE expedition_id=?',
        id,
      ),
      safe: await scalar(
        "SELECT COUNT(*) value FROM personnel WHERE expedition_id=? AND status='Safe'",
        id,
      ),
      moving: await scalar(
        "SELECT COUNT(*) value FROM personnel WHERE expedition_id=? AND status IN ('Moving','Deployed')",
        id,
      ),
      attention: await scalar(
        "SELECT COUNT(*) value FROM personnel WHERE expedition_id=? AND status NOT IN ('Safe','Moving','Deployed')",
        id,
      ),
    },
    cargo: {
      total: await scalar(
        'SELECT COUNT(*) value FROM cargo WHERE expedition_id=?',
        id,
      ),
      in_transit: await scalar(
        "SELECT COUNT(*) value FROM cargo WHERE expedition_id=? AND status='In Transit'",
        id,
      ),
      delivered: await scalar(
        "SELECT COUNT(*) value FROM cargo WHERE expedition_id=? AND status='Delivered'",
        id,
      ),
    },
    inventory_warnings: await scalar(
      'SELECT COUNT(*) value FROM inventory_items WHERE expedition_id=? AND quantity < min_quantity',
      id,
    ),
    vehicles: {
      total: vehicleRows.length,
      operational: vehicleRows.filter((row) => row.status === 'Operational')
        .length,
      low_fuel: vehicleRows.filter(
        (row) => Number(row.fuel_percent) < 30,
      ).length,
      average_fuel: vehicleRows.length
        ? Math.round(
            vehicleRows.reduce(
              (sum, row) => sum + Number(row.fuel_percent || 0),
              0,
            ) / vehicleRows.length,
          )
        : 0,
    },
    active_incidents: await scalar(
      "SELECT COUNT(*) value FROM incidents WHERE expedition_id=? AND status!='Resolved'",
      id,
    ),
    operational_risks: alerts
      .filter((item) => item.status !== 'Resolved')
      .slice(0, 8),
    recent_activity: await all(
      `SELECT a.*,u.name user_name
       FROM activity a
       LEFT JOIN users u ON u.id=a.user_id
       WHERE a.expedition_id=?
       ORDER BY a.created_at DESC,a.id DESC
       LIMIT 12`,
      id,
    ),
  };
}
