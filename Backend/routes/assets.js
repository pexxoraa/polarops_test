import { Router } from 'express';
import { all, get } from '../utils/config/database.js';
import Asset from '../models/Asset.js';
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

const details = (id) =>
  get(
    `SELECT a.*,l.name location_name,p.name assigned_to_name
     FROM assets a
     LEFT JOIN locations l ON l.id=a.location_id
     LEFT JOIN personnel p ON p.id=a.assigned_to_personnel_id
     WHERE a.id=?`,
    Number(id),
  );

router.get(
  '/',
  requirePermission('assets.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      res.json(
        await all(
          `SELECT a.*,l.name location_name,p.name assigned_to_name
           FROM assets a
           LEFT JOIN locations l ON l.id=a.location_id
           LEFT JOIN personnel p ON p.id=a.assigned_to_personnel_id
           WHERE a.expedition_id=?
           ORDER BY a.code`,
          expedition.id,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/',
  requirePermission('assets.manage'),
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
      await ensureEntityInExpedition(
        'personnel',
        req.body.assigned_to_personnel_id,
        expedition.id,
        'Assigned personnel',
      );

      const item = await Asset.create({
        expedition_id: expedition.id,
        code: String(req.body.code).toUpperCase(),
        name: req.body.name,
        category: req.body.category || 'Equipment',
        location_id: req.body.location_id || null,
        status: req.body.status || 'Available',
        serial_number: req.body.serial_number || '',
        assigned_to_personnel_id:
          req.body.assigned_to_personnel_id || null,
        created_at: nowIso(),
      });

      await recordActivity(
        expedition.id,
        'asset',
        'Asset ' + item.code + ' added',
        req.user.id,
      );
      await recordAudit(
        req.user,
        expedition.id,
        'created',
        'asset',
        item.id,
        req.body,
      );
      await broadcast(
        expedition.id,
        makeEvent(
          'asset.created',
          expedition.id,
          'asset',
          item.id,
        ),
      );
      res.status(201).json(await details(item.id));
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        error = new HttpError(409, 'Asset code already exists');
      }
      next(error);
    }
  },
);

router.patch(
  '/:id',
  requirePermission('assets.manage'),
  async (req, res, next) => {
    try {
      const item = await Asset.getById(req.params.id);
      if (!item) throw new HttpError(404, 'Asset not found');

      await ensureExpeditionAccess(req.user, item.expedition_id);
      await ensureEntityInExpedition(
        'locations',
        req.body.location_id,
        item.expedition_id,
        'Location',
      );
      await ensureEntityInExpedition(
        'personnel',
        req.body.assigned_to_personnel_id,
        item.expedition_id,
        'Assigned personnel',
      );

      await Asset.update(item.id, req.body);
      await recordAudit(
        req.user,
        item.expedition_id,
        'updated',
        'asset',
        item.id,
        req.body,
      );
      await broadcast(
        item.expedition_id,
        makeEvent(
          'asset.updated',
          item.expedition_id,
          'asset',
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
