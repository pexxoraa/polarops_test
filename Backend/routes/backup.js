import { Router } from 'express';
import { all, get } from '../utils/config/database.js';
import { authRequired } from '../utils/middleware/auth.js';
import { requirePermission } from '../utils/middleware/permissions.js';

const router = Router();

router.get(
  '/',
  authRequired,
  requirePermission('operations.manage'),
  async (req, res, next) => {
    try {
      const organizationId = req.user.organization_id;
      const expeditions = await all(
        'SELECT * FROM expeditions WHERE organization_id=? ORDER BY id',
        organizationId,
      );
      const expeditionIds = expeditions.map((item) => item.id);

      async function byExpedition(table) {
        const rows = [];
        for (const id of expeditionIds) {
          rows.push(
            ...(await all(
              'SELECT * FROM ' +
                table +
                ' WHERE expedition_id=? ORDER BY id',
              id,
            )),
          );
        }
        return rows;
      }

      const cargo = await byExpedition('cargo');
      const inventory = await byExpedition('inventory_items');
      const incidents = await byExpedition('incidents');

      const cargoEvents = [];
      for (const item of cargo) {
        cargoEvents.push(
          ...(await all(
            'SELECT * FROM cargo_events WHERE cargo_id=? ORDER BY id',
            item.id,
          )),
        );
      }

      const inventoryEvents = [];
      for (const item of inventory) {
        inventoryEvents.push(
          ...(await all(
            'SELECT * FROM inventory_events WHERE inventory_id=? ORDER BY id',
            item.id,
          )),
        );
      }

      const incidentEvents = [];
      const incidentActions = [];
      for (const item of incidents) {
        incidentEvents.push(
          ...(await all(
            'SELECT * FROM incident_events WHERE incident_id=? ORDER BY id',
            item.id,
          )),
        );
        incidentActions.push(
          ...(await all(
            'SELECT * FROM incident_actions WHERE incident_id=? ORDER BY id',
            item.id,
          )),
        );
      }

      const payload = {
        version: 1,
        created_at: new Date().toISOString(),
        organization: await get(
          'SELECT * FROM organizations WHERE id=?',
          organizationId,
        ),
        users: await all(
          `SELECT id,organization_id,email,name,role,active,created_at
           FROM users
           WHERE organization_id=?
           ORDER BY id`,
          organizationId,
        ),
        expeditions,
        locations: await byExpedition('locations'),
        personnel: await byExpedition('personnel'),
        cargo,
        inventory_items: inventory,
        vehicles: await byExpedition('vehicles'),
        assets: await byExpedition('assets'),
        incidents,
        activity: await byExpedition('activity'),
        telemetry_positions: await byExpedition(
          'telemetry_positions',
        ),
        mission_tasks: await byExpedition('mission_tasks'),
        planned_routes: await byExpedition('planned_routes'),
        geofences: await byExpedition('geofences'),
        ops_alerts: await byExpedition('ops_alerts'),
        science_records: await byExpedition('science_records'),
        comms_checkins: await byExpedition('comms_checkins'),
        readiness_items: await byExpedition('readiness_items'),
        shift_handovers: await byExpedition('shift_handovers'),
        cargo_events: cargoEvents,
        inventory_events: inventoryEvents,
        incident_events: incidentEvents,
        incident_actions: incidentActions,
      };

      res.setHeader(
        'Content-Disposition',
        'attachment; filename="polarops-backup.json"',
      );
      res.json(payload);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
