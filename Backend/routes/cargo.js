import { Router } from 'express';
import { all, get, run } from '../utils/config/database.js';
import Cargo from '../models/Cargo.js';
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

function parseCargoScan(value, expectedExpeditionId) {
  const raw = String(value || '').trim();
  if (!raw) {
    throw new HttpError(400, 'Cargo ID or QR value is required');
  }

  const match = raw.match(/^POLAROPS:CARGO:(\d+):(.+)$/i);
  if (!match) return raw.toUpperCase();

  const scannedExpeditionId = Number(match[1]);
  if (scannedExpeditionId !== Number(expectedExpeditionId)) {
    throw new HttpError(
      400,
      'Scanned cargo belongs to another expedition',
    );
  }
  return match[2].trim().toUpperCase();
}

const details = (id) =>
  get(
    `SELECT c.*,
      ('POLAROPS:CARGO:' || c.expedition_id || ':' || c.code) qr_value,
      o.name origin_name,
      d.name destination_name,
      l.name location_name
     FROM cargo c
     LEFT JOIN locations o ON o.id=c.origin_location_id
     LEFT JOIN locations d ON d.id=c.destination_location_id
     LEFT JOIN locations l ON l.id=c.current_location_id
     WHERE c.id=?`,
    Number(id),
  );

router.get(
  '/',
  requirePermission('cargo.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      res.json(
        await all(
          `SELECT c.*,
            ('POLAROPS:CARGO:' || c.expedition_id || ':' || c.code) qr_value,
            o.name origin_name,
            d.name destination_name,
            l.name location_name
           FROM cargo c
           LEFT JOIN locations o ON o.id=c.origin_location_id
           LEFT JOIN locations d ON d.id=c.destination_location_id
           LEFT JOIN locations l ON l.id=c.current_location_id
           WHERE c.expedition_id=?
           ORDER BY c.created_at DESC,c.id DESC`,
          expedition.id,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/lookup',
  requirePermission('cargo.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      const code = parseCargoScan(
        req.query.value,
        expedition.id,
      );
      const item = await get(
        `SELECT id FROM cargo
         WHERE expedition_id=? AND upper(code)=upper(?)`,
        expedition.id,
        code,
      );
      if (!item) throw new HttpError(404, 'Cargo ID not found');
      res.json(await details(item.id));
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/',
  requirePermission('cargo.manage'),
  async (req, res, next) => {
    try {
      requireFields(req.body, 'expedition_id', 'code', 'name');
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.body.expedition_id,
      );

      for (const [field, label] of [
        ['origin_location_id', 'Origin'],
        ['destination_location_id', 'Destination'],
        ['current_location_id', 'Current location'],
      ]) {
        await ensureEntityInExpedition(
          'locations',
          req.body[field],
          expedition.id,
          label,
        );
      }

      const item = await Cargo.create({
        expedition_id: expedition.id,
        code: String(req.body.code).toUpperCase(),
        name: req.body.name,
        priority: req.body.priority || 'Medium',
        origin_location_id: req.body.origin_location_id || null,
        destination_location_id:
          req.body.destination_location_id || null,
        current_location_id: req.body.current_location_id || null,
        status: req.body.status || 'Registered',
        quantity: Number(req.body.quantity ?? 1),
        unit: req.body.unit || 'unit',
        assigned_to: req.body.assigned_to || '',
        created_at: nowIso(),
      });

      await run(
        `INSERT INTO cargo_events(
          cargo_id,location_id,event_type,note,user_id,created_at,
          from_custodian,to_custodian,custody_action
        ) VALUES(?,?,?,?,?,?,?,?,?)`,
        item.id,
        item.current_location_id,
        'Registered',
        'Cargo registered',
        req.user.id,
        nowIso(),
        '',
        item.assigned_to || '',
        'Registered',
      );

      await recordActivity(
        expedition.id,
        'cargo',
        'Cargo ' + item.code + ' registered',
        req.user.id,
      );
      await recordAudit(
        req.user,
        expedition.id,
        'created',
        'cargo',
        item.id,
        req.body,
      );
      await broadcast(
        expedition.id,
        makeEvent(
          'cargo.created',
          expedition.id,
          'cargo',
          item.id,
        ),
      );
      res.status(201).json(await details(item.id));
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        error = new HttpError(409, 'Cargo code already exists');
      }
      next(error);
    }
  },
);

router.patch(
  '/:id',
  requirePermission('cargo.manage'),
  async (req, res, next) => {
    try {
      const item = await Cargo.getById(req.params.id);
      if (!item) throw new HttpError(404, 'Cargo not found');

      await ensureExpeditionAccess(req.user, item.expedition_id);
      for (const [field, label] of [
        ['origin_location_id', 'Origin'],
        ['destination_location_id', 'Destination'],
        ['current_location_id', 'Current location'],
      ]) {
        await ensureEntityInExpedition(
          'locations',
          req.body[field],
          item.expedition_id,
          label,
        );
      }

      await Cargo.update(item.id, req.body);
      await recordAudit(
        req.user,
        item.expedition_id,
        'updated',
        'cargo',
        item.id,
        req.body,
      );
      await broadcast(
        item.expedition_id,
        makeEvent(
          'cargo.updated',
          item.expedition_id,
          'cargo',
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
  '/:id/move',
  requirePermission('cargo.manage'),
  async (req, res, next) => {
    try {
      const item = await Cargo.getById(req.params.id);
      if (!item) throw new HttpError(404, 'Cargo not found');

      await ensureExpeditionAccess(req.user, item.expedition_id);
      requireFields(req.body, 'location_id');
      await ensureEntityInExpedition(
        'locations',
        req.body.location_id,
        item.expedition_id,
        'Location',
      );

      const status = req.body.status || item.status;
      await Cargo.update(item.id, {
        current_location_id: Number(req.body.location_id),
        status,
      });

      await run(
        `INSERT INTO cargo_events(
          cargo_id,location_id,event_type,note,user_id,created_at,
          from_custodian,to_custodian,custody_action
        ) VALUES(?,?,?,?,?,?,?,?,?)`,
        item.id,
        Number(req.body.location_id),
        'Movement',
        req.body.note || '',
        req.user.id,
        nowIso(),
        item.assigned_to || '',
        item.assigned_to || '',
        'Movement',
      );

      await recordActivity(
        item.expedition_id,
        'cargo',
        'Cargo ' + item.code + ' moved',
        req.user.id,
      );
      await recordAudit(
        req.user,
        item.expedition_id,
        'moved',
        'cargo',
        item.id,
        req.body,
      );
      await broadcast(
        item.expedition_id,
        makeEvent(
          'cargo.moved',
          item.expedition_id,
          'cargo',
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
  '/:id/custody',
  requirePermission('cargo.manage'),
  async (req, res, next) => {
    try {
      const item = await Cargo.getById(req.params.id);
      if (!item) throw new HttpError(404, 'Cargo not found');

      await ensureExpeditionAccess(req.user, item.expedition_id);
      requireFields(req.body, 'to_custodian');

      const toCustodian = String(
        req.body.to_custodian || '',
      ).trim();
      if (!toCustodian) {
        throw new HttpError(400, 'New custodian is required');
      }

      const locationId =
        req.body.location_id == null
          ? item.current_location_id
          : Number(req.body.location_id);

      await ensureEntityInExpedition(
        'locations',
        locationId,
        item.expedition_id,
        'Location',
      );

      await Cargo.update(item.id, {
        assigned_to: toCustodian,
        current_location_id: locationId,
        status: req.body.status || item.status,
      });

      await run(
        `INSERT INTO cargo_events(
          cargo_id,location_id,event_type,note,user_id,created_at,
          from_custodian,to_custodian,custody_action
        ) VALUES(?,?,?,?,?,?,?,?,?)`,
        item.id,
        locationId,
        'Custody',
        req.body.note || '',
        req.user.id,
        nowIso(),
        item.assigned_to || '',
        toCustodian,
        'Handoff',
      );

      await recordActivity(
        item.expedition_id,
        'cargo',
        'Cargo ' +
          item.code +
          ' custody transferred to ' +
          toCustodian,
        req.user.id,
      );
      await recordAudit(
        req.user,
        item.expedition_id,
        'custody',
        'cargo',
        item.id,
        req.body,
      );
      await broadcast(
        item.expedition_id,
        makeEvent(
          'cargo.custody',
          item.expedition_id,
          'cargo',
          item.id,
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
  requirePermission('cargo.read'),
  async (req, res, next) => {
    try {
      const item = await Cargo.getById(req.params.id);
      if (!item) throw new HttpError(404, 'Cargo not found');

      await ensureExpeditionAccess(req.user, item.expedition_id);
      res.json(
        await all(
          `SELECT e.*,l.name location_name,u.name user_name
           FROM cargo_events e
           LEFT JOIN locations l ON l.id=e.location_id
           LEFT JOIN users u ON u.id=e.user_id
           WHERE e.cargo_id=?
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
