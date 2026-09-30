import { Router } from 'express';
import { all, get, run } from '../utils/config/database.js';
import Inventory from '../models/Inventory.js';
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
    `SELECT i.*,l.name location_name
     FROM inventory_items i
     LEFT JOIN locations l ON l.id=i.location_id
     WHERE i.id=?`,
    Number(id),
  );

router.get(
  '/',
  requirePermission('inventory.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      res.json(
        await all(
          `SELECT i.*,l.name location_name
           FROM inventory_items i
           LEFT JOIN locations l ON l.id=i.location_id
           WHERE i.expedition_id=?
           ORDER BY i.name`,
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
  requirePermission('inventory.manage'),
  async (req, res, next) => {
    try {
      requireFields(req.body, 'expedition_id', 'sku', 'name');
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

      const item = await Inventory.create({
        expedition_id: expedition.id,
        sku: String(req.body.sku).toUpperCase(),
        name: req.body.name,
        location_id: req.body.location_id || null,
        quantity: Number(req.body.quantity || 0),
        min_quantity: Number(req.body.min_quantity || 0),
        unit: req.body.unit || 'units',
        expiry_date: req.body.expiry_date || null,
        created_at: nowIso(),
      });

      await recordActivity(
        expedition.id,
        'inventory',
        'Inventory ' + item.sku + ' added',
        req.user.id,
      );
      await recordAudit(
        req.user,
        expedition.id,
        'created',
        'inventory',
        item.id,
        req.body,
      );
      await broadcast(
        expedition.id,
        makeEvent(
          'inventory.created',
          expedition.id,
          'inventory',
          item.id,
        ),
      );
      res.status(201).json(await details(item.id));
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        error = new HttpError(
          409,
          'Inventory SKU already exists',
        );
      }
      next(error);
    }
  },
);

router.patch(
  '/:id',
  requirePermission('inventory.manage'),
  async (req, res, next) => {
    try {
      const item = await Inventory.getById(req.params.id);
      if (!item) {
        throw new HttpError(404, 'Inventory item not found');
      }

      await ensureExpeditionAccess(req.user, item.expedition_id);
      await ensureEntityInExpedition(
        'locations',
        req.body.location_id,
        item.expedition_id,
        'Location',
      );

      await Inventory.update(item.id, req.body);
      await recordAudit(
        req.user,
        item.expedition_id,
        'updated',
        'inventory',
        item.id,
        req.body,
      );
      await broadcast(
        item.expedition_id,
        makeEvent(
          'inventory.updated',
          item.expedition_id,
          'inventory',
          item.id,
        ),
      );
      res.json(await details(item.id));
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:id/adjust',
  requirePermission('inventory.manage'),
  async (req, res, next) => {
    try {
      requireFields(req.body, 'delta', 'reason');
      const item = await Inventory.getById(req.params.id);
      if (!item) {
        throw new HttpError(404, 'Inventory item not found');
      }

      await ensureExpeditionAccess(req.user, item.expedition_id);

      const delta = Number(req.body.delta);
      if (!Number.isFinite(delta)) {
        throw new HttpError(400, 'Invalid adjustment');
      }

      const nextQuantity = Number(item.quantity) + delta;
      if (nextQuantity < 0) {
        throw new HttpError(
          400,
          'Inventory cannot go below zero',
        );
      }

      await Inventory.update(item.id, {
        quantity: nextQuantity,
      });
      await run(
        `INSERT INTO inventory_events(
          inventory_id,delta,reason,user_id,created_at
        ) VALUES(?,?,?,?,?)`,
        item.id,
        delta,
        req.body.reason,
        req.user.id,
        nowIso(),
      );
      await recordActivity(
        item.expedition_id,
        'inventory',
        item.name +
          ' adjusted by ' +
          delta +
          ' ' +
          item.unit,
        req.user.id,
      );
      await recordAudit(
        req.user,
        item.expedition_id,
        'adjusted',
        'inventory',
        item.id,
        req.body,
      );
      await broadcast(
        item.expedition_id,
        makeEvent(
          'inventory.adjusted',
          item.expedition_id,
          'inventory',
          item.id,
          { delta },
        ),
      );
      res.json(await details(item.id));
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/:id/events',
  requirePermission('inventory.read'),
  async (req, res, next) => {
    try {
      const item = await Inventory.getById(req.params.id);
      if (!item) {
        throw new HttpError(404, 'Inventory item not found');
      }

      await ensureExpeditionAccess(req.user, item.expedition_id);
      res.json(
        await all(
          `SELECT e.*,u.name user_name
           FROM inventory_events e
           LEFT JOIN users u ON u.id=e.user_id
           WHERE e.inventory_id=?
           ORDER BY e.created_at DESC,e.id DESC`,
          item.id,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

export default router;
