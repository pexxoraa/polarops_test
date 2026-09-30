import { Router } from 'express';
import { all, get } from '../utils/config/database.js';
import Alert from '../models/Alert.js';
import Vehicle from '../models/Vehicle.js';
import { authRequired } from '../utils/middleware/auth.js';
import { requirePermission } from '../utils/middleware/permissions.js';
import { HttpError } from '../utils/http.js';
import { nowIso } from '../utils/helpers.js';
import {
  ensureEntityInExpedition,
  ensureExpeditionAccess,
  requireFields,
} from '../utils/validation.js';
import {
  recordActivity,
  recordAudit,
} from '../utils/services/activityService.js';
import {
  broadcast,
  makeEvent,
} from '../utils/services/realtimeService.js';

const router = Router();
router.use(authRequired);
const VEHICLE_ISSUE_TYPES = [
  'Vehicle Breakdown',
  'Out of Fuel',
  'Technical Issue',
  'Mechanical Issue',
  'Natural Disaster',
  'Other',
];

const vehicleAlerts = (vehicleId) =>
  all(
    `SELECT * FROM ops_alerts
     WHERE entity_type='vehicle' AND entity_id=?
     ORDER BY created_at DESC,id DESC`,
    Number(vehicleId),
  );

const details = (id) =>
  get(
    `SELECT v.*,l.name location_name,
       (SELECT COUNT(*) FROM ops_alerts a
        WHERE a.entity_type='vehicle' AND a.entity_id=v.id AND a.status!='Resolved') active_alert_count,
       (SELECT a.title FROM ops_alerts a
        WHERE a.entity_type='vehicle' AND a.entity_id=v.id AND a.status!='Resolved'
        ORDER BY a.created_at DESC,a.id DESC LIMIT 1) active_alert_cause
     FROM vehicles v
     LEFT JOIN locations l ON l.id=v.location_id
     WHERE v.id=?`,
    Number(id),
  );

router.get(
  '/',
  requirePermission('vehicles.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      res.json(
        await all(
            `SELECT v.*,l.name location_name,
             (SELECT COUNT(*) FROM ops_alerts a
              WHERE a.entity_type='vehicle' AND a.entity_id=v.id AND a.status!='Resolved') active_alert_count,
             (SELECT a.title FROM ops_alerts a
              WHERE a.entity_type='vehicle' AND a.entity_id=v.id AND a.status!='Resolved'
              ORDER BY a.created_at DESC,a.id DESC LIMIT 1) active_alert_cause
           FROM vehicles v
           LEFT JOIN locations l ON l.id=v.location_id
           WHERE v.expedition_id=?
           ORDER BY v.code`,
          expedition.id,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/:id/alerts',
  requirePermission('vehicles.read'),
  async (req, res, next) => {
    try {
      const vehicle = await Vehicle.getById(req.params.id);
      if (!vehicle) throw new HttpError(404, 'Vehicle not found');
      await ensureExpeditionAccess(req.user, vehicle.expedition_id);
      res.json({ items: await vehicleAlerts(vehicle.id) });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:id/alerts',
  requirePermission('vehicles.manage'),
  async (req, res, next) => {
    try {
      requireFields(req.body, 'issue_type');
      if (!VEHICLE_ISSUE_TYPES.includes(req.body.issue_type)) {
        throw new HttpError(400, 'Invalid vehicle issue type');
      }
      const vehicle = await Vehicle.getById(req.params.id);
      if (!vehicle) throw new HttpError(404, 'Vehicle not found');
      await ensureExpeditionAccess(req.user, vehicle.expedition_id);

      const item = await Alert.create({
        expedition_id: vehicle.expedition_id,
        severity: req.body.severity || 'Warning',
        source: 'Vehicle',
        title: req.body.issue_type,
        detail: req.body.detail?.trim() || null,
        status: 'Open',
        entity_type: 'vehicle',
        entity_id: vehicle.id,
        created_by: req.user.id,
        created_at: nowIso(),
        acknowledged_at: null,
        resolved_at: null,
      });

      await recordActivity(
        vehicle.expedition_id,
        'vehicle',
        vehicle.code + ' reported: ' + item.title,
        req.user.id,
      );
      await recordAudit(
        req.user,
        vehicle.expedition_id,
        'created',
        'alert',
        item.id,
        req.body,
      );
      await broadcast(
        vehicle.expedition_id,
        makeEvent('alert.created', vehicle.expedition_id, 'alert', item.id),
      );
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/:id/alerts/:alertId/resolve',
  requirePermission('vehicles.manage'),
  async (req, res, next) => {
    try {
      const vehicle = await Vehicle.getById(req.params.id);
      if (!vehicle) throw new HttpError(404, 'Vehicle not found');
      await ensureExpeditionAccess(req.user, vehicle.expedition_id);
      const item = await Alert.getById(req.params.alertId);
      if (
        !item ||
        item.expedition_id !== vehicle.expedition_id ||
        item.entity_type !== 'vehicle' ||
        item.entity_id !== vehicle.id
      ) {
        throw new HttpError(404, 'Vehicle alert not found');
      }

      const resolvedAt = item.resolved_at || nowIso();
      const updated = await Alert.update(item.id, {
        status: 'Resolved',
        resolved_at: resolvedAt,
      });
      await recordActivity(
        vehicle.expedition_id,
        'vehicle',
        vehicle.code + ' alert resolved: ' + item.title,
        req.user.id,
      );
      await recordAudit(
        req.user,
        vehicle.expedition_id,
        'updated',
        'alert',
        item.id,
        { status: 'Resolved' },
      );
      await broadcast(
        vehicle.expedition_id,
        makeEvent('alert.updated', vehicle.expedition_id, 'alert', item.id),
      );
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/',
  requirePermission('vehicles.manage'),
  async (req, res, next) => {
    try {
      requireFields(req.body, 'expedition_id', 'code', 'name');
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

      const item = await Vehicle.create({
        expedition_id: expedition.id,
        code: String(req.body.code).toUpperCase(),
        name: req.body.name,
        type: req.body.type || 'Ground',
        location_id: req.body.location_id || null,
        status: req.body.status || 'Operational',
        fuel_percent: Number(req.body.fuel_percent ?? 100),
        range_km: Number(req.body.range_km || 0),
        created_at: nowIso(),
      });

      await recordActivity(
        expedition.id,
        'vehicle',
        'Vehicle ' + item.code + ' added',
        req.user.id,
      );
      await recordAudit(
        req.user,
        expedition.id,
        'created',
        'vehicle',
        item.id,
        req.body,
      );
      await broadcast(
        expedition.id,
        makeEvent(
          'vehicle.created',
          expedition.id,
          'vehicle',
          item.id,
        ),
      );
      res.status(201).json(await details(item.id));
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        error = new HttpError(409, 'Vehicle code already exists');
      }
      next(error);
    }
  },
);

router.patch(
  '/:id',
  requirePermission('vehicles.manage'),
  async (req, res, next) => {
    try {
      const item = await Vehicle.getById(req.params.id);
      if (!item) throw new HttpError(404, 'Vehicle not found');

      await ensureExpeditionAccess(req.user, item.expedition_id);
      await ensureEntityInExpedition(
        'locations',
        req.body.location_id,
        item.expedition_id,
        'Location',
      );

      if (req.body.fuel_percent !== undefined) {
        const fuel = Number(req.body.fuel_percent);
        if (!Number.isFinite(fuel) || fuel < 0 || fuel > 100) {
          throw new HttpError(
            400,
            'Fuel percent must be between 0 and 100',
          );
        }
        req.body.fuel_percent = fuel;
      }

      await Vehicle.update(item.id, req.body);
      await recordAudit(
        req.user,
        item.expedition_id,
        'updated',
        'vehicle',
        item.id,
        req.body,
      );
      await broadcast(
        item.expedition_id,
        makeEvent(
          'vehicle.updated',
          item.expedition_id,
          'vehicle',
          item.id,
        ),
      );
      res.json(await details(item.id));
    } catch (error) {
      next(error);
    }
  },
);

export default router;
