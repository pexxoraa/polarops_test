import { Router } from 'express';
import { all, get } from '../utils/config/database.js';
import Personnel from '../models/Personnel.js';
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

const router = Router();
router.use(authRequired);

const details = (id) =>
  get(
    `SELECT p.*,l.name location_name
     FROM personnel p
     LEFT JOIN locations l ON l.id=p.location_id
     WHERE p.id=?`,
    Number(id),
  );

router.get(
  '/',
  requirePermission('personnel.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      res.json(
        await all(
          `SELECT p.*,l.name location_name
           FROM personnel p
           LEFT JOIN locations l ON l.id=p.location_id
           WHERE p.expedition_id=?
           ORDER BY p.team,p.name`,
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
  requirePermission('personnel.manage'),
  async (req, res, next) => {
    try {
      requireFields(req.body, 'expedition_id', 'name', 'role');
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

      const item = await Personnel.create({
        expedition_id: expedition.id,
        external_id: req.body.external_id || null,
        name: req.body.name,
        role: req.body.role,
        team: req.body.team || '',
        location_id: req.body.location_id || null,
        status: req.body.status || 'Safe',
        last_checkin: req.body.last_checkin || null,
        contact: req.body.contact || '',
        clearance_status: req.body.clearance_status || 'Cleared',
        source: req.body.source || 'manual',
        is_synthetic: req.body.is_synthetic ? 1 : 0,
        created_at: nowIso(),
      });

      await recordActivity(
        expedition.id,
        'personnel',
        'Personnel ' + item.name + ' added',
        req.user.id,
      );
      await recordAudit(
        req.user,
        expedition.id,
        'created',
        'personnel',
        item.id,
        req.body,
      );
      res.status(201).json(await details(item.id));
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  '/:id',
  requirePermission('personnel.manage'),
  async (req, res, next) => {
    try {
      const item = await Personnel.getById(req.params.id);
      if (!item) throw new HttpError(404, 'Personnel not found');

      await ensureExpeditionAccess(req.user, item.expedition_id);
      await ensureEntityInExpedition(
        'locations',
        req.body.location_id,
        item.expedition_id,
        'Location',
      );

      const updated = await Personnel.update(item.id, req.body);
      await recordAudit(
        req.user,
        item.expedition_id,
        'updated',
        'personnel',
        item.id,
        req.body,
      );
      res.json(await details(updated.id));
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:id/checkin',
  requirePermission('personnel.checkin'),
  async (req, res, next) => {
    try {
      const item = await Personnel.getById(req.params.id);
      if (!item) throw new HttpError(404, 'Personnel not found');

      await ensureExpeditionAccess(req.user, item.expedition_id);
      await ensureEntityInExpedition(
        'locations',
        req.body.location_id,
        item.expedition_id,
        'Location',
      );

      await Personnel.update(item.id, {
        location_id: req.body.location_id ?? item.location_id,
        status: req.body.status || 'Safe',
        last_checkin: nowIso(),
      });
      await recordActivity(
        item.expedition_id,
        'personnel',
        item.name + ' checked in',
        req.user.id,
      );
      await recordAudit(
        req.user,
        item.expedition_id,
        'checkin',
        'personnel',
        item.id,
        req.body,
      );
      res.json(await details(item.id));
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  '/:id',
  requirePermission('personnel.manage'),
  async (req, res, next) => {
    try {
      const item = await Personnel.getById(req.params.id);
      if (!item) throw new HttpError(404, 'Personnel not found');

      await ensureExpeditionAccess(req.user, item.expedition_id);
      await Personnel.delete(item.id);
      await recordAudit(
        req.user,
        item.expedition_id,
        'deleted',
        'personnel',
        item.id,
      );
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
