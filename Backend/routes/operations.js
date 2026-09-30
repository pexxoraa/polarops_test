import { Router } from 'express';
import { all, get, run } from '../utils/config/database.js';
import MissionTask from '../models/MissionTask.js';
import Alert from '../models/Alert.js';
import ScienceRecord from '../models/ScienceRecord.js';
import Communication from '../models/Communication.js';
import Readiness from '../models/Readiness.js';
import Handover from '../models/Handover.js';
import Route from '../models/Route.js';
import { authRequired } from '../utils/middleware/auth.js';
import { requirePermission } from '../utils/middleware/permissions.js';
import { HttpError } from '../utils/http.js';
import { nowIso } from '../utils/helpers.js';
import {
  ensureEntityInExpedition,
  ensureExpeditionAccess,
  requireFields,
  validateCoordinates,
} from '../utils/validation.js';
import { recordAudit } from '../utils/services/activityService.js';
import { getUnifiedAlerts } from '../utils/services/alertService.js';
import {
  createPlannedRoute,
  haversineKm,
} from '../utils/services/routeService.js';
import {
  broadcast,
  makeEvent,
} from '../utils/services/realtimeService.js';

const router = Router();
router.use(authRequired);

async function entity(table, id, label) {
  const row = await get(
    'SELECT * FROM ' + table + ' WHERE id=?',
    Number(id),
  );
  if (!row) throw new HttpError(404, label + ' not found');
  return row;
}

async function scalar(sql, id) {
  const row = await get(sql, Number(id));
  return Number(row?.value || 0);
}

router.get(
  '/summary',
  requirePermission('operations.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      const id = expedition.id;
      const alerts = await getUnifiedAlerts(id);

      res.json({
        tasks_open: await scalar(
          "SELECT COUNT(*) value FROM mission_tasks WHERE expedition_id=? AND status NOT IN ('Complete','Cancelled')",
          id,
        ),
        routes_active: await scalar(
          "SELECT COUNT(*) value FROM planned_routes WHERE expedition_id=? AND status NOT IN ('Complete','Cancelled')",
          id,
        ),
        alerts_open: alerts.filter(
          (item) => item.status !== 'Resolved',
        ).length,
        readiness_total: await scalar(
          'SELECT COUNT(*) value FROM readiness_items WHERE expedition_id=?',
          id,
        ),
        readiness_complete: await scalar(
          "SELECT COUNT(*) value FROM readiness_items WHERE expedition_id=? AND status='Complete'",
          id,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/tasks',
  requirePermission('operations.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      res.json({
        items: await all(
          `SELECT t.*,l.name location_name
           FROM mission_tasks t
           LEFT JOIN locations l ON l.id=t.location_id
           WHERE t.expedition_id=?
           ORDER BY COALESCE(t.due_at,t.created_at),t.id`,
          expedition.id,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/tasks',
  requirePermission('operations.manage'),
  async (req, res, next) => {
    try {
      requireFields(req.body, 'expedition_id', 'title');
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.body.expedition_id,
      );
      await ensureEntityInExpedition(
        'locations',
        req.body.location_id,
        expedition.id,
        'Location',
      );

      const ts = nowIso();
      const item = await MissionTask.create({
        expedition_id: expedition.id,
        title: req.body.title,
        category: req.body.category || 'Operations',
        status: req.body.status || 'Planned',
        priority: req.body.priority || 'Normal',
        start_at: req.body.start_at || null,
        due_at: req.body.due_at || null,
        assigned_to: req.body.assigned_to || null,
        location_id: req.body.location_id || null,
        notes: req.body.notes || null,
        created_by: req.user.id,
        created_at: ts,
        updated_at: ts,
      });

      await recordAudit(
        req.user,
        expedition.id,
        'created',
        'task',
        item.id,
        req.body,
      );
      await broadcast(
        expedition.id,
        makeEvent(
          'task.created',
          expedition.id,
          'task',
          item.id,
        ),
      );
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/tasks/:id',
  requirePermission('operations.manage'),
  async (req, res, next) => {
    try {
      const item = await entity(
        'mission_tasks',
        req.params.id,
        'Task',
      );
      await ensureExpeditionAccess(
        req.user,
        item.expedition_id,
      );
      await ensureEntityInExpedition(
        'locations',
        req.body.location_id,
        item.expedition_id,
        'Location',
      );

      await MissionTask.update(item.id, {
        ...req.body,
        updated_at: nowIso(),
      });
      await recordAudit(
        req.user,
        item.expedition_id,
        'updated',
        'task',
        item.id,
        req.body,
      );
      await broadcast(
        item.expedition_id,
        makeEvent(
          'task.updated',
          item.expedition_id,
          'task',
          item.id,
        ),
      );
      res.json(await entity('mission_tasks', item.id, 'Task'));
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/routes',
  requirePermission('routes.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      res.json({
        items: await all(
          `SELECT r.*,v.code vehicle_code,v.name vehicle_name,
            p.name personnel_name
           FROM planned_routes r
           LEFT JOIN vehicles v ON v.id=r.vehicle_id
           LEFT JOIN personnel p ON p.id=r.personnel_id
           WHERE r.expedition_id=?
           ORDER BY r.created_at DESC`,
          expedition.id,
        ),
        geofences: await all(
          `SELECT * FROM geofences
           WHERE expedition_id=?
           ORDER BY active DESC,name`,
          expedition.id,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/routes',
  requirePermission('routes.manage'),
  async (req, res, next) => {
    try {
      requireFields(
        req.body,
        'expedition_id',
        'name',
        'start_lat',
        'start_lon',
        'end_lat',
        'end_lon',
      );
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.body.expedition_id,
      );
      const item = await createPlannedRoute(req.user, {
        ...req.body,
        expedition_id: expedition.id,
      });
      await recordAudit(
        req.user,
        expedition.id,
        'created',
        'route',
        item.id,
        req.body,
      );
      await broadcast(
        expedition.id,
        makeEvent(
          'route.created',
          expedition.id,
          'route',
          item.id,
        ),
      );
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/routes/:id',
  requirePermission('routes.manage'),
  async (req, res, next) => {
    try {
      const item = await entity(
        'planned_routes',
        req.params.id,
        'Route',
      );
      await ensureExpeditionAccess(req.user, item.expedition_id);

      const [startLat, startLon] = validateCoordinates(
        req.body.start_lat ?? item.start_lat,
        req.body.start_lon ?? item.start_lon,
        'Route start',
      );
      const [endLat, endLon] = validateCoordinates(
        req.body.end_lat ?? item.end_lat,
        req.body.end_lon ?? item.end_lon,
        'Route destination',
      );
      const vehicleId = req.body.vehicle_id === undefined
        ? item.vehicle_id
        : req.body.vehicle_id || null;
      const personnelId = req.body.personnel_id === undefined
        ? item.personnel_id
        : req.body.personnel_id || null;
      await ensureEntityInExpedition(
        'vehicles',
        vehicleId,
        item.expedition_id,
        'Vehicle',
      );
      await ensureEntityInExpedition(
        'personnel',
        personnelId,
        item.expedition_id,
        'Team leader',
      );

      const vehicle = vehicleId
        ? await get('SELECT * FROM vehicles WHERE id=?', Number(vehicleId))
        : null;
      const distance = Number(
        haversineKm(startLat, startLon, endLat, endLon).toFixed(2),
      );
      const isAircraft = vehicle?.type === 'Aircraft';
      const updated = await Route.update(item.id, {
        name: req.body.name ?? item.name,
        start_lat: startLat,
        start_lon: startLon,
        end_lat: endLat,
        end_lon: endLon,
        distance_km: distance,
        eta_minutes: Math.max(1, Math.round((distance / (isAircraft ? 220 : 25)) * 60)),
        fuel_liters: Number((distance * (isAircraft ? 2.6 : 0.6)).toFixed(1)),
        vehicle_id: vehicleId,
        personnel_id: personnelId,
        status: req.body.status ?? item.status,
        risk_summary: req.body.risk_summary ?? item.risk_summary,
        updated_at: nowIso(),
      });

      await recordAudit(
        req.user,
        item.expedition_id,
        'updated',
        'route',
        item.id,
        req.body,
      );
      await broadcast(
        item.expedition_id,
        makeEvent('route.updated', item.expedition_id, 'route', item.id),
      );
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  '/routes/:id',
  requirePermission('routes.manage'),
  async (req, res, next) => {
    try {
      const item = await entity(
        'planned_routes',
        req.params.id,
        'Route',
      );
      await ensureExpeditionAccess(req.user, item.expedition_id);
      await Route.delete(item.id);
      await recordAudit(
        req.user,
        item.expedition_id,
        'deleted',
        'route',
        item.id,
      );
      await broadcast(
        item.expedition_id,
        makeEvent('route.deleted', item.expedition_id, 'route', item.id),
      );
      res.json({ ok: true, id: item.id });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/geofences',
  requirePermission('routes.manage'),
  async (req, res, next) => {
    try {
      requireFields(
        req.body,
        'expedition_id',
        'name',
        'center_lat',
        'center_lon',
      );
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.body.expedition_id,
      );
      const [lat, lon] = validateCoordinates(
        req.body.center_lat,
        req.body.center_lon,
        'Geofence center',
      );
      const ts = nowIso();

      const result = await run(
        `INSERT INTO geofences(
          expedition_id,name,kind,center_lat,center_lon,radius_m,
          severity,active,notes,created_by,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
        expedition.id,
        req.body.name,
        req.body.kind || 'Safe zone',
        lat,
        lon,
        Number(req.body.radius_m || 1000),
        req.body.severity || 'Warning',
        req.body.active === false ? 0 : 1,
        req.body.notes || null,
        req.user.id,
        ts,
        ts,
      );
      const item = await get(
        'SELECT * FROM geofences WHERE id=?',
        Number(result.lastInsertRowid),
      );
      await recordAudit(
        req.user,
        expedition.id,
        'created',
        'geofence',
        item.id,
        req.body,
      );
      await broadcast(
        expedition.id,
        makeEvent(
          'geofence.created',
          expedition.id,
          'geofence',
          item.id,
        ),
      );
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/alerts',
  requirePermission('operations.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      res.json({
        items: await getUnifiedAlerts(expedition.id),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/alerts',
  requirePermission('operations.manage'),
  async (req, res, next) => {
    try {
      requireFields(req.body, 'expedition_id', 'title');
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.body.expedition_id,
      );

      const item = await Alert.create({
        expedition_id: expedition.id,
        severity: req.body.severity || 'Advisory',
        source: req.body.source || 'Manual',
        title: req.body.title,
        detail: req.body.detail || null,
        status: 'Open',
        assigned_to: req.body.assigned_to || null,
        entity_type: req.body.entity_type || null,
        entity_id: req.body.entity_id || null,
        created_by: req.user.id,
        created_at: nowIso(),
        acknowledged_at: null,
        resolved_at: null,
      });

      await recordAudit(
        req.user,
        expedition.id,
        'created',
        'alert',
        item.id,
        req.body,
      );
      await broadcast(
        expedition.id,
        makeEvent(
          'alert.created',
          expedition.id,
          'alert',
          item.id,
        ),
      );
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/alerts/:id',
  requirePermission('operations.manage'),
  async (req, res, next) => {
    try {
      const item = await entity(
        'ops_alerts',
        req.params.id,
        'Alert',
      );
      await ensureExpeditionAccess(
        req.user,
        item.expedition_id,
      );

      const status = req.body.status || item.status;
      await Alert.update(item.id, {
        status,
        assigned_to:
          req.body.assigned_to ?? item.assigned_to,
        acknowledged_at:
          status === 'Acknowledged'
            ? nowIso()
            : item.acknowledged_at,
        resolved_at:
          status === 'Resolved'
            ? nowIso()
            : item.resolved_at,
      });

      await recordAudit(
        req.user,
        item.expedition_id,
        'updated',
        'alert',
        item.id,
        req.body,
      );
      await broadcast(
        item.expedition_id,
        makeEvent(
          'alert.updated',
          item.expedition_id,
          'alert',
          item.id,
        ),
      );
      res.json(await entity('ops_alerts', item.id, 'Alert'));
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/science',
  requirePermission('operations.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      res.json({
        items: await all(
          `SELECT s.*,p.name researcher_name
           FROM science_records s
           LEFT JOIN personnel p ON p.id=s.researcher_id
           WHERE s.expedition_id=?
           ORDER BY COALESCE(s.collected_at,s.created_at) DESC`,
          expedition.id,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/science',
  requirePermission('science.manage'),
  async (req, res, next) => {
    try {
      requireFields(
        req.body,
        'expedition_id',
        'project',
        'title',
      );
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.body.expedition_id,
      );
      await ensureEntityInExpedition(
        'personnel',
        req.body.researcher_id,
        expedition.id,
        'Researcher',
      );

      let lat = null;
      let lon = null;
      if (
        req.body.latitude !== undefined ||
        req.body.longitude !== undefined
      ) {
        [lat, lon] = validateCoordinates(
          req.body.latitude,
          req.body.longitude,
          'Science coordinates',
        );
      }

      const item = await ScienceRecord.create({
        expedition_id: expedition.id,
        project: req.body.project,
        sample_id: req.body.sample_id || null,
        record_type: req.body.record_type || 'Observation',
        title: req.body.title,
        latitude: lat,
        longitude: lon,
        collected_at: req.body.collected_at || nowIso(),
        researcher_id: req.body.researcher_id || null,
        storage_location:
          req.body.storage_location || null,
        notes: req.body.notes || null,
        created_by: req.user.id,
        created_at: nowIso(),
      });

      await recordAudit(
        req.user,
        expedition.id,
        'created',
        'science_record',
        item.id,
        req.body,
      );
      await broadcast(
        expedition.id,
        makeEvent(
          'science.created',
          expedition.id,
          'science',
          item.id,
        ),
      );
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/comms',
  requirePermission('operations.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      res.json({
        items: await all(
          `SELECT * FROM comms_checkins
           WHERE expedition_id=?
           ORDER BY expected_at DESC`,
          expedition.id,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/comms',
  requirePermission('operations.manage'),
  async (req, res, next) => {
    try {
      requireFields(
        req.body,
        'expedition_id',
        'team_name',
        'expected_at',
      );
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.body.expedition_id,
      );
      const ts = nowIso();

      const item = await Communication.create({
        expedition_id: expedition.id,
        team_name: req.body.team_name,
        channel: req.body.channel || 'Satellite',
        expected_at: req.body.expected_at,
        actual_at: null,
        status: 'Expected',
        notes: req.body.notes || null,
        created_by: req.user.id,
        created_at: ts,
        updated_at: ts,
      });

      await recordAudit(
        req.user,
        expedition.id,
        'created',
        'comms_checkin',
        item.id,
        req.body,
      );
      await broadcast(
        expedition.id,
        makeEvent(
          'comms.created',
          expedition.id,
          'communication',
          item.id,
        ),
      );
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/comms/:id',
  requirePermission('operations.manage'),
  async (req, res, next) => {
    try {
      const item = await entity(
        'comms_checkins',
        req.params.id,
        'Communications check-in',
      );
      await ensureExpeditionAccess(
        req.user,
        item.expedition_id,
      );

      const status = req.body.status || item.status;
      await Communication.update(item.id, {
        status,
        actual_at:
          req.body.actual_at ||
          (status === 'Completed'
            ? nowIso()
            : item.actual_at),
        notes: req.body.notes ?? item.notes,
        updated_at: nowIso(),
      });

      await recordAudit(
        req.user,
        item.expedition_id,
        'updated',
        'comms_checkin',
        item.id,
        req.body,
      );
      await broadcast(
        item.expedition_id,
        makeEvent(
          'comms.updated',
          item.expedition_id,
          'communication',
          item.id,
        ),
      );
      res.json(
        await entity(
          'comms_checkins',
          item.id,
          'Communications check-in',
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/readiness',
  requirePermission('operations.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      const items = await all(
        `SELECT * FROM readiness_items
         WHERE expedition_id=?
         ORDER BY category,label`,
        expedition.id,
      );
      res.json({
        items,
        complete: items.filter(
          (item) => item.status === 'Complete',
        ).length,
        total: items.length,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/readiness',
  requirePermission('operations.manage'),
  async (req, res, next) => {
    try {
      requireFields(
        req.body,
        'expedition_id',
        'category',
        'label',
      );
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.body.expedition_id,
      );
      const ts = nowIso();

      const item = await Readiness.create({
        expedition_id: expedition.id,
        category: req.body.category,
        label: req.body.label,
        status: req.body.status || 'Pending',
        owner: req.body.owner || null,
        due_at: req.body.due_at || null,
        notes: req.body.notes || null,
        updated_by: req.user.id,
        created_at: ts,
        updated_at: ts,
      });

      await recordAudit(
        req.user,
        expedition.id,
        'created',
        'readiness_item',
        item.id,
        req.body,
      );
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/readiness/:id',
  requirePermission('operations.manage'),
  async (req, res, next) => {
    try {
      const item = await entity(
        'readiness_items',
        req.params.id,
        'Readiness item',
      );
      await ensureExpeditionAccess(
        req.user,
        item.expedition_id,
      );

      await Readiness.update(item.id, {
        status: req.body.status || item.status,
        owner: req.body.owner ?? item.owner,
        notes: req.body.notes ?? item.notes,
        updated_by: req.user.id,
        updated_at: nowIso(),
      });

      await recordAudit(
        req.user,
        item.expedition_id,
        'updated',
        'readiness_item',
        item.id,
        req.body,
      );
      res.json(
        await entity(
          'readiness_items',
          item.id,
          'Readiness item',
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/incident-command/:incidentId',
  requirePermission('operations.read'),
  async (req, res, next) => {
    try {
      const incident = await entity(
        'incidents',
        req.params.incidentId,
        'Incident',
      );
      await ensureExpeditionAccess(
        req.user,
        incident.expedition_id,
      );

      res.json({
        incident,
        actions: await all(
          `SELECT * FROM incident_actions
           WHERE incident_id=?
           ORDER BY created_at,id`,
          incident.id,
        ),
        events: await all(
          `SELECT * FROM incident_events
           WHERE incident_id=?
           ORDER BY created_at,id`,
          incident.id,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/incident-command/:incidentId/actions',
  requirePermission('incidents.manage'),
  async (req, res, next) => {
    try {
      requireFields(req.body, 'task');
      const incident = await entity(
        'incidents',
        req.params.incidentId,
        'Incident',
      );
      await ensureExpeditionAccess(
        req.user,
        incident.expedition_id,
      );

      const ts = nowIso();
      const result = await run(
        `INSERT INTO incident_actions(
          incident_id,task,owner,status,due_at,notes,
          created_by,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?)`,
        incident.id,
        req.body.task,
        req.body.owner || null,
        req.body.status || 'Open',
        req.body.due_at || null,
        req.body.notes || null,
        req.user.id,
        ts,
        ts,
      );
      const item = await get(
        'SELECT * FROM incident_actions WHERE id=?',
        Number(result.lastInsertRowid),
      );
      await recordAudit(
        req.user,
        incident.expedition_id,
        'created',
        'incident_action',
        item.id,
        req.body,
      );
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/incident-command/actions/:id',
  requirePermission('incidents.manage'),
  async (req, res, next) => {
    try {
      const item = await get(
        `SELECT a.*,i.expedition_id
         FROM incident_actions a
         JOIN incidents i ON i.id=a.incident_id
         WHERE a.id=?`,
        Number(req.params.id),
      );
      if (!item) {
        throw new HttpError(
          404,
          'Incident action not found',
        );
      }

      await ensureExpeditionAccess(
        req.user,
        item.expedition_id,
      );
      await run(
        `UPDATE incident_actions
         SET status=?,owner=?,notes=?,updated_at=?
         WHERE id=?`,
        req.body.status || item.status,
        req.body.owner ?? item.owner,
        req.body.notes ?? item.notes,
        nowIso(),
        item.id,
      );
      await recordAudit(
        req.user,
        item.expedition_id,
        'updated',
        'incident_action',
        item.id,
        req.body,
      );
      res.json(
        await get(
          'SELECT * FROM incident_actions WHERE id=?',
          item.id,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/handovers',
  requirePermission('operations.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      res.json({
        items: await all(
          `SELECT h.*,u.name author_name
           FROM shift_handovers h
           LEFT JOIN users u ON u.id=h.author_user_id
           WHERE h.expedition_id=?
           ORDER BY h.created_at DESC`,
          expedition.id,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/handovers',
  requirePermission('operations.manage'),
  async (req, res, next) => {
    try {
      requireFields(
        req.body,
        'expedition_id',
        'shift_name',
        'summary',
      );
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.body.expedition_id,
      );

      const item = await Handover.create({
        expedition_id: expedition.id,
        shift_name: req.body.shift_name,
        author_user_id: req.user.id,
        summary: req.body.summary,
        unresolved_alerts:
          req.body.unresolved_alerts || null,
        deployed_teams: req.body.deployed_teams || null,
        vehicle_issues: req.body.vehicle_issues || null,
        weather_notes: req.body.weather_notes || null,
        cargo_priorities:
          req.body.cargo_priorities || null,
        science_ops: req.body.science_ops || null,
        next_tasks: req.body.next_tasks || null,
        created_at: nowIso(),
      });

      await recordAudit(
        req.user,
        expedition.id,
        'created',
        'shift_handover',
        item.id,
        req.body,
      );
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/sitrep',
  requirePermission('operations.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      const id = expedition.id;
      const readinessTotal = await scalar(
        'SELECT COUNT(*) value FROM readiness_items WHERE expedition_id=?',
        id,
      );

      res.json({
        generated_at: nowIso(),
        expedition,
        personnel: {
          total: await scalar(
            'SELECT COUNT(*) value FROM personnel WHERE expedition_id=?',
            id,
          ),
          overdue: await scalar(
            "SELECT COUNT(*) value FROM personnel WHERE expedition_id=? AND status IN ('Overdue','Check-in due','Unknown')",
            id,
          ),
          deployed: await scalar(
            "SELECT COUNT(*) value FROM personnel WHERE expedition_id=? AND status IN ('Moving','Deployed')",
            id,
          ),
        },
        vehicles: {
          total: await scalar(
            'SELECT COUNT(*) value FROM vehicles WHERE expedition_id=?',
            id,
          ),
          operational: await scalar(
            "SELECT COUNT(*) value FROM vehicles WHERE expedition_id=? AND status='Operational'",
            id,
          ),
        },
        inventory_warnings: await scalar(
          'SELECT COUNT(*) value FROM inventory_items WHERE expedition_id=? AND quantity<min_quantity',
          id,
        ),
        active_incidents: await scalar(
          "SELECT COUNT(*) value FROM incidents WHERE expedition_id=? AND status!='Resolved'",
          id,
        ),
        cargo_in_transit: await scalar(
          "SELECT COUNT(*) value FROM cargo WHERE expedition_id=? AND status NOT IN ('Delivered','Cancelled')",
          id,
        ),
        alerts: (await getUnifiedAlerts(id)).slice(0, 10),
        readiness: {
          complete: await scalar(
            "SELECT COUNT(*) value FROM readiness_items WHERE expedition_id=? AND status='Complete'",
            id,
          ),
          total: readinessTotal,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/audit',
  requirePermission('audit.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      const limit = Math.max(
        1,
        Math.min(Number(req.query.limit || 200), 500),
      );

      const explicit = (
        await all(
          `SELECT a.*,u.name user_name
           FROM audit_events a
           LEFT JOIN users u ON u.id=a.user_id
           WHERE a.expedition_id=?
           ORDER BY a.created_at DESC
           LIMIT ?`,
          expedition.id,
          limit,
        )
      ).map((item) => ({ kind: 'audit', ...item }));

      const activity = (
        await all(
          `SELECT a.*,u.name user_name
           FROM activity a
           LEFT JOIN users u ON u.id=a.user_id
           WHERE a.expedition_id=?
           ORDER BY a.created_at DESC
           LIMIT ?`,
          expedition.id,
          limit,
        )
      ).map((item) => ({
        kind: 'activity',
        ...item,
      }));

      res.json({
        items: [...explicit, ...activity]
          .sort((a, b) =>
            String(b.created_at).localeCompare(
              String(a.created_at),
            ),
          )
          .slice(0, limit),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/search',
  requirePermission('operations.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      const query = String(req.query.q || '').trim();
      if (query.length < 2) {
        res.json({ items: [] });
        return;
      }

      const term = '%' + query + '%';
      const items = [];
      const specs = [
        [
          'personnel',
          'SELECT id,name title,role detail FROM personnel WHERE expedition_id=? AND (name LIKE ? OR role LIKE ?) LIMIT 8',
          2,
        ],
        [
          'cargo',
          'SELECT id,code title,name detail FROM cargo WHERE expedition_id=? AND (code LIKE ? OR name LIKE ?) LIMIT 8',
          2,
        ],
        [
          'inventory',
          'SELECT id,name title,sku detail FROM inventory_items WHERE expedition_id=? AND (name LIKE ? OR sku LIKE ?) LIMIT 8',
          2,
        ],
        [
          'vehicle',
          'SELECT id,code title,name detail FROM vehicles WHERE expedition_id=? AND (code LIKE ? OR name LIKE ?) LIMIT 8',
          2,
        ],
        [
          'asset',
          'SELECT id,code title,name detail FROM assets WHERE expedition_id=? AND (code LIKE ? OR name LIKE ? OR category LIKE ?) LIMIT 8',
          3,
        ],
        [
          'incident',
          'SELECT id,title,status detail FROM incidents WHERE expedition_id=? AND (title LIKE ? OR description LIKE ?) LIMIT 8',
          2,
        ],
        [
          'task',
          'SELECT id,title,status detail FROM mission_tasks WHERE expedition_id=? AND (title LIKE ? OR notes LIKE ?) LIMIT 8',
          2,
        ],
        [
          'route',
          'SELECT id,name title,risk_summary detail FROM planned_routes WHERE expedition_id=? AND (name LIKE ? OR risk_summary LIKE ?) LIMIT 8',
          2,
        ],
        [
          'science',
          'SELECT id,title,project detail FROM science_records WHERE expedition_id=? AND (title LIKE ? OR project LIKE ? OR sample_id LIKE ?) LIMIT 8',
          3,
        ],
      ];

      for (const [kind, sql, count] of specs) {
        for (const row of await all(
          sql,
          expedition.id,
          ...Array(count).fill(term),
        )) {
          items.push({ kind, ...row });
        }
      }

      for (const row of await all(
        `SELECT id,name title,country detail
         FROM public_facilities
         WHERE name LIKE ? OR country LIKE ?
         LIMIT 8`,
        term,
        term,
      )) {
        items.push({ kind: 'facility', ...row });
      }

      for (const row of await all(
        `SELECT id,name title,location detail
         FROM arctic_research_stations
         WHERE name LIKE ? OR location LIKE ?
         LIMIT 8`,
        term,
        term,
      )) {
        items.push({ kind: 'arctic_station', ...row });
      }

      res.json({ items: items.slice(0, 50) });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
