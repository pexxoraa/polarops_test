import { Router } from 'express';
import { all, get, run } from '../utils/config/database.js';
import { authRequired } from '../utils/middleware/auth.js';
import { requirePermission } from '../utils/middleware/permissions.js';
import { HttpError } from '../utils/http.js';
import { nowIso } from '../utils/helpers.js';
import {
  ensureExpeditionAccess,
  requireFields,
  validateCoordinates,
} from '../utils/validation.js';
import {
  recordActivity,
  recordAudit,
} from '../utils/services/activityService.js';

const router = Router();
router.use(authRequired);

router.get(
  '/expeditions',
  requirePermission('expeditions.read'),
  async (req, res, next) => {
    try {
      res.json(
        await all(
          'SELECT * FROM expeditions WHERE organization_id=? ORDER BY id',
          req.user.organization_id,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/expeditions',
  requirePermission('operations.manage'),
  async (req, res, next) => {
    try {
      requireFields(req.body, 'name', 'region');
      const result = await run(
        `INSERT INTO expeditions(
          organization_id,name,region,start_date,end_date,status,description,created_at
        ) VALUES(?,?,?,?,?,?,?,?)`,
        req.user.organization_id,
        req.body.name,
        req.body.region,
        req.body.start_date || null,
        req.body.end_date || null,
        req.body.status || 'Planning',
        req.body.description || '',
        nowIso(),
      );
      const item = await get(
        'SELECT * FROM expeditions WHERE id=?',
        Number(result.lastInsertRowid),
      );
      await recordAudit(
        req.user,
        item.id,
        'created',
        'expedition',
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
  '/expeditions/:id',
  requirePermission('operations.manage'),
  async (req, res, next) => {
    try {
      const item = await ensureExpeditionAccess(
        req.user,
        req.params.id,
      );
      const keys = [
        'name',
        'region',
        'start_date',
        'end_date',
        'status',
        'description',
      ].filter((key) => req.body[key] !== undefined);

      if (keys.length) {
        await run(
          'UPDATE expeditions SET ' +
            keys.map((key) => key + '=?').join(',') +
            ' WHERE id=?',
          ...keys.map((key) => req.body[key]),
          item.id,
        );
      }

      await recordAudit(
        req.user,
        item.id,
        'updated',
        'expedition',
        item.id,
        req.body,
      );
      res.json(
        await get('SELECT * FROM expeditions WHERE id=?', item.id),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/locations',
  requirePermission('expeditions.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      res.json(
        await all(
          'SELECT * FROM locations WHERE expedition_id=? ORDER BY name',
          expedition.id,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/locations',
  requirePermission('locations.manage'),
  async (req, res, next) => {
    try {
      requireFields(req.body, 'expedition_id', 'name');
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.body.expedition_id,
      );
      let latitude = null;
      let longitude = null;

      if (
        req.body.latitude !== undefined &&
        req.body.latitude !== null &&
        req.body.latitude !== ''
      ) {
        [latitude, longitude] = validateCoordinates(
          req.body.latitude,
          req.body.longitude,
        );
      }

      const result = await run(
        `INSERT INTO locations(
          expedition_id,name,type,latitude,longitude,source,external_id
        ) VALUES(?,?,?,?,?,?,?)`,
        expedition.id,
        req.body.name,
        req.body.type || 'Camp',
        latitude,
        longitude,
        req.body.source || 'manual',
        req.body.external_id || null,
      );
      const item = await get(
        'SELECT * FROM locations WHERE id=?',
        Number(result.lastInsertRowid),
      );

      await recordActivity(
        expedition.id,
        'location',
        'Location ' + item.name + ' added',
        req.user.id,
      );
      await recordAudit(
        req.user,
        expedition.id,
        'created',
        'location',
        item.id,
        req.body,
      );
      res.status(201).json(item);
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        error = new HttpError(
          409,
          'Location name already exists',
        );
      }
      next(error);
    }
  },
);

router.patch(
  '/locations/:id',
  requirePermission('locations.manage'),
  async (req, res, next) => {
    try {
      const current = await get(
        'SELECT * FROM locations WHERE id=?',
        Number(req.params.id),
      );
      if (!current) {
        throw new HttpError(404, 'Location not found');
      }

      await ensureExpeditionAccess(
        req.user,
        current.expedition_id,
      );

      const body = { ...req.body };
      delete body.expedition_id;

      if (
        body.latitude !== undefined ||
        body.longitude !== undefined
      ) {
        const pair = validateCoordinates(
          body.latitude ?? current.latitude,
          body.longitude ?? current.longitude,
        );
        body.latitude = pair[0];
        body.longitude = pair[1];
      }

      const keys = [
        'name',
        'type',
        'latitude',
        'longitude',
        'source',
        'external_id',
      ].filter((key) => body[key] !== undefined);

      if (keys.length) {
        await run(
          'UPDATE locations SET ' +
            keys.map((key) => key + '=?').join(',') +
            ' WHERE id=?',
          ...keys.map((key) => body[key]),
          current.id,
        );
      }

      await recordAudit(
        req.user,
        current.expedition_id,
        'updated',
        'location',
        current.id,
        body,
      );
      res.json(
        await get('SELECT * FROM locations WHERE id=?', current.id),
      );
    } catch (error) {
      next(error);
    }
  },
);

export default router;
