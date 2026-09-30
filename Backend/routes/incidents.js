import { Router } from 'express';
import { all, get, run } from '../utils/config/database.js';
import Incident from '../models/Incident.js';
import { authRequired } from '../utils/middleware/auth.js';
import {
  hasPermission,
  requirePermission,
} from '../utils/middleware/permissions.js';
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
const INCIDENT_TYPES = [
  'Field Emergency',
  'Medical',
  'Vehicle',
  'Weather',
  'Communications',
  'Safety',
  'Environmental',
];
const INCIDENT_SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];

const detail = (id) =>
  get(
    `SELECT i.*,l.name location_name,v.code vehicle_code,
      v.name vehicle_name,u.name created_by_name
     FROM incidents i
     LEFT JOIN locations l ON l.id=i.location_id
     LEFT JOIN vehicles v ON v.id=i.assigned_vehicle_id
     LEFT JOIN users u ON u.id=i.created_by
     WHERE i.id=?`,
    Number(id),
  );

router.get(
  '/',
  requirePermission('incidents.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      res.json(
        await all(
          `SELECT i.*,l.name location_name,v.code vehicle_code
           FROM incidents i
           LEFT JOIN locations l ON l.id=i.location_id
           LEFT JOIN vehicles v ON v.id=i.assigned_vehicle_id
           WHERE i.expedition_id=?
           ORDER BY CASE i.status
             WHEN 'Active' THEN 0
             WHEN 'Response' THEN 1
             ELSE 2
           END,i.created_at DESC`,
          expedition.id,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.post('/sos', async (req, res, next) => {
  try {
    if (
      !hasPermission(req.user, 'incidents.manage') &&
      !hasPermission(req.user, 'incidents.create')
    ) {
      throw new HttpError(403, 'Permission denied');
    }

    requireFields(req.body, 'expedition_id');
    const expedition = await ensureExpeditionAccess(
      req.user,
      req.body.expedition_id,
    );
    const hasLatitude = req.body.latitude !== undefined && req.body.latitude !== null;
    const hasLongitude = req.body.longitude !== undefined && req.body.longitude !== null;
    let latitude = null;
    let longitude = null;

    if (hasLatitude || hasLongitude) {
      latitude = Number(req.body.latitude);
      longitude = Number(req.body.longitude);
      if (
        !hasLatitude ||
        !hasLongitude ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        throw new HttpError(400, 'Valid latitude and longitude are required');
      }
    }

    const location = latitude === null
      ? req.user.name + ' account location (GPS unavailable)'
      : 'GPS coordinates: ' + latitude.toFixed(5) + ', ' + longitude.toFixed(5);
    const countRow = await get(
      'SELECT COUNT(*) value FROM incidents WHERE expedition_id=?',
      expedition.id,
    );
    const code = 'INC-' + String(Number(countRow?.value || 0) + 1).padStart(3, '0');
    const createdAt = nowIso();
    const description = [
      'EMERGENCY SOS activated by ' + req.user.name + ' (' + req.user.email + ').',
      'Origin account: ' + req.user.email,
      'Location: ' + location,
    ].join(' ');
    const item = await Incident.create({
      expedition_id: expedition.id,
      code,
      title: 'EMERGENCY',
      type: 'Field Emergency',
      severity: 'Critical',
      location_id: null,
      status: 'Active',
      description,
      affected_count: 0,
      assigned_vehicle_id: null,
      created_by: req.user.id,
      created_at: createdAt,
      resolved_at: null,
    });

    await run(
      `INSERT INTO incident_events(
        incident_id,event_type,note,user_id,created_at
      ) VALUES(?,?,?,?,?)`,
      item.id,
      'SOS activated',
      description,
      req.user.id,
      createdAt,
    );
    await recordActivity(
      expedition.id,
      'incident',
      'EMERGENCY SOS activated by ' + req.user.name,
      req.user.id,
    );
    await recordAudit(req.user, expedition.id, 'created', 'incident', item.id, {
      source: 'SOS',
      latitude,
      longitude,
    });
    await broadcast(
      expedition.id,
      makeEvent('incident.created', expedition.id, 'incident', item.id),
    );
    const emergencyEvent = makeEvent(
      'emergency.sos',
      expedition.id,
      'incident',
      item.id,
      {
        message: 'EMERGENCY',
        incident_id: item.id,
        incident_code: item.code,
        initiated_by: req.user.name,
        account: req.user.email,
        expedition_name: expedition.name,
        location,
        latitude,
        longitude,
      },
    );
    await broadcast(expedition.id, emergencyEvent);

    res.status(201).json({
      ...(await detail(item.id)),
      emergency_event: emergencyEvent,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    if (
      !hasPermission(req.user, 'incidents.manage') &&
      !hasPermission(req.user, 'incidents.create')
    ) {
      throw new HttpError(403, 'Permission denied');
    }

    requireFields(req.body, 'expedition_id', 'title');
    const expedition = await ensureExpeditionAccess(
      req.user,
      req.body.expedition_id,
    );
    await ensureEntityInExpedition(
      'locations',
      req.body.location_id,
      expedition.id,
      'Incident location',
    );

    const countRow = await get(
      'SELECT COUNT(*) value FROM incidents WHERE expedition_id=?',
      expedition.id,
    );
    const count = Number(countRow?.value || 0);
    const code =
      req.body.code ||
      'INC-' + String(count + 1).padStart(3, '0');

    const item = await Incident.create({
      expedition_id: expedition.id,
      code,
      title: req.body.title,
      type: req.body.type || 'Field Emergency',
      severity: req.body.severity || 'High',
      location_id: req.body.location_id || null,
      status: req.body.status || 'Active',
      description: req.body.description || '',
      affected_count: Number(req.body.affected_count || 0),
      assigned_vehicle_id: null,
      created_by: req.user.id,
      created_at: nowIso(),
      resolved_at: null,
    });

    await run(
      `INSERT INTO incident_events(
        incident_id,event_type,note,user_id,created_at
      ) VALUES(?,?,?,?,?)`,
      item.id,
      'Incident created',
      req.body.description || item.title,
      req.user.id,
      nowIso(),
    );
    await recordActivity(
      expedition.id,
      'incident',
      'Incident ' + item.code + ' activated',
      req.user.id,
    );
    await recordAudit(
      req.user,
      expedition.id,
      'created',
      'incident',
      item.id,
      req.body,
    );
    await broadcast(
      expedition.id,
      makeEvent(
        'incident.created',
        expedition.id,
        'incident',
        item.id,
      ),
    );
    res.status(201).json(await detail(item.id));
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      error = new HttpError(
        409,
        'Incident code already exists',
      );
    }
    next(error);
  }
});

router.get(
  '/:id',
  requirePermission('incidents.read'),
  async (req, res, next) => {
    try {
      const item = await Incident.getById(req.params.id);
      if (!item) throw new HttpError(404, 'Incident not found');

      await ensureExpeditionAccess(req.user, item.expedition_id);
      res.json({
        ...(await detail(item.id)),
        events: await all(
          `SELECT e.*,u.name user_name
           FROM incident_events e
           LEFT JOIN users u ON u.id=e.user_id
           WHERE e.incident_id=?
           ORDER BY e.created_at,e.id`,
          item.id,
        ),
        actions: await all(
          `SELECT * FROM incident_actions
           WHERE incident_id=?
           ORDER BY created_at,id`,
          item.id,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/:id',
  requirePermission('incidents.manage'),
  async (req, res, next) => {
    try {
      const item = await Incident.getById(req.params.id);
      if (!item) throw new HttpError(404, 'Incident not found');
      await ensureExpeditionAccess(req.user, item.expedition_id);

      if (req.body.type === undefined && req.body.severity === undefined) {
        throw new HttpError(400, 'Incident type or severity is required');
      }
      const type = req.body.type ?? item.type;
      const severity = req.body.severity ?? item.severity;
      if (!INCIDENT_TYPES.includes(type)) {
        throw new HttpError(400, 'Invalid incident type');
      }
      if (!INCIDENT_SEVERITIES.includes(severity)) {
        throw new HttpError(400, 'Invalid incident severity');
      }

      await Incident.update(item.id, { type, severity });
      const changes = [];
      if (type !== item.type) changes.push('Type changed to ' + type);
      if (severity !== item.severity) {
        changes.push('Severity changed to ' + severity);
      }
      const note =
        String(req.body.note || '').trim() ||
        (changes.length ? changes.join('; ') : 'Incident details reviewed');
      await run(
        `INSERT INTO incident_events(
          incident_id,event_type,note,user_id,created_at
        ) VALUES(?,?,?,?,?)`,
        item.id,
        'Incident updated',
        note,
        req.user.id,
        nowIso(),
      );
      await recordActivity(
        item.expedition_id,
        'incident',
        'Incident ' + item.code + ' updated',
        req.user.id,
      );
      await recordAudit(
        req.user,
        item.expedition_id,
        'updated',
        'incident',
        item.id,
        req.body,
      );
      await broadcast(
        item.expedition_id,
        makeEvent('incident.updated', item.expedition_id, 'incident', item.id),
      );
      res.json(await detail(item.id));
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:id/dispatch',
  requirePermission('incidents.manage'),
  async (req, res, next) => {
    try {
      const item = await Incident.getById(req.params.id);
      if (!item) throw new HttpError(404, 'Incident not found');

      await ensureExpeditionAccess(req.user, item.expedition_id);
      requireFields(req.body, 'vehicle_id');
      await ensureEntityInExpedition(
        'vehicles',
        req.body.vehicle_id,
        item.expedition_id,
        'Response vehicle',
      );

      await Incident.update(item.id, {
        assigned_vehicle_id: Number(req.body.vehicle_id),
        status: 'Response',
      });
      await run(
        `INSERT INTO incident_events(
          incident_id,event_type,note,user_id,created_at
        ) VALUES(?,?,?,?,?)`,
        item.id,
        'Vehicle dispatched',
        req.body.note || 'Response vehicle assigned',
        req.user.id,
        nowIso(),
      );
      await recordAudit(
        req.user,
        item.expedition_id,
        'dispatched',
        'incident',
        item.id,
        req.body,
      );
      await broadcast(
        item.expedition_id,
        makeEvent(
          'incident.dispatched',
          item.expedition_id,
          'incident',
          item.id,
        ),
      );
      res.json(await detail(item.id));
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:id/resolve',
  requirePermission('incidents.manage'),
  async (req, res, next) => {
    try {
      const item = await Incident.getById(req.params.id);
      if (!item) throw new HttpError(404, 'Incident not found');

      await ensureExpeditionAccess(req.user, item.expedition_id);
      await Incident.update(item.id, {
        status: 'Resolved',
        resolved_at: nowIso(),
      });
      await run(
        `INSERT INTO incident_events(
          incident_id,event_type,note,user_id,created_at
        ) VALUES(?,?,?,?,?)`,
        item.id,
        'Resolved',
        req.body.note || 'Incident resolved',
        req.user.id,
        nowIso(),
      );
      await recordActivity(
        item.expedition_id,
        'incident',
        'Incident ' + item.code + ' resolved',
        req.user.id,
      );
      await recordAudit(
        req.user,
        item.expedition_id,
        'resolved',
        'incident',
        item.id,
        req.body,
      );
      await broadcast(
        item.expedition_id,
        makeEvent(
          'incident.resolved',
          item.expedition_id,
          'incident',
          item.id,
        ),
      );
      res.json(await detail(item.id));
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:id/events',
  requirePermission('incidents.manage'),
  async (req, res, next) => {
    try {
      const item = await Incident.getById(req.params.id);
      if (!item) throw new HttpError(404, 'Incident not found');

      await ensureExpeditionAccess(req.user, item.expedition_id);
      requireFields(req.body, 'note');

      const result = await run(
        `INSERT INTO incident_events(
          incident_id,event_type,note,user_id,created_at
        ) VALUES(?,?,?,?,?)`,
        item.id,
        req.body.event_type || 'Update',
        req.body.note,
        req.user.id,
        nowIso(),
      );
      await recordAudit(
        req.user,
        item.expedition_id,
        'event_added',
        'incident',
        item.id,
        req.body,
      );
      await broadcast(
        item.expedition_id,
        makeEvent(
          'incident.event',
          item.expedition_id,
          'incident',
          item.id,
        ),
      );
      res.status(201).json(
        await get(
          'SELECT * FROM incident_events WHERE id=?',
          Number(result.lastInsertRowid),
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

export default router;
