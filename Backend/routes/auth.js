import { Router } from 'express';
import { all, get, run } from '../utils/config/database.js';
import { authRequired } from '../utils/middleware/auth.js';
import { requireRole } from '../utils/middleware/permissions.js';
import { HttpError } from '../utils/http.js';
import {
  ensureExpeditionAccess,
  requireFields,
} from '../utils/validation.js';
import {
  hashPassword,
  makeRealtimeTicket,
  makeToken,
  verifyPassword,
} from '../utils/security.js';
import { nowIso } from '../utils/helpers.js';

const router = Router();

router.post('/auth/login', async (req, res, next) => {
  try {
    requireFields(req.body, 'email', 'password');
    const user = await get(
      'SELECT * FROM users WHERE lower(email)=lower(?) AND active=1',
      String(req.body.email).trim(),
    );
    if (
      !user ||
      !verifyPassword(String(req.body.password), user.password_hash)
    ) {
      throw new HttpError(401, 'Invalid email or password');
    }

    const { password_hash, ...safeUser } = user;
    res.json({ token: makeToken(user), user: safeUser });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authRequired, (req, res) => res.json(req.user));

router.get('/bootstrap', authRequired, async (req, res, next) => {
  try {
    const expeditions = await all(
      'SELECT * FROM expeditions WHERE organization_id=? ORDER BY id',
      req.user.organization_id,
    );
    res.json({ user: req.user, expeditions });
  } catch (error) {
    next(error);
  }
});

router.post('/me/password', authRequired, async (req, res, next) => {
  try {
    requireFields(req.body, 'current_password', 'new_password');
    if (String(req.body.new_password).length < 8) {
      throw new HttpError(
        400,
        'New password must be at least 8 characters',
      );
    }

    const current = await get(
      'SELECT * FROM users WHERE id=?',
      req.user.id,
    );
    if (
      !current ||
      !verifyPassword(
        String(req.body.current_password),
        current.password_hash,
      )
    ) {
      throw new HttpError(400, 'Current password is incorrect');
    }

    await run(
      'UPDATE users SET password_hash=? WHERE id=?',
      hashPassword(String(req.body.new_password)),
      req.user.id,
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/realtime/ticket', authRequired, async (req, res, next) => {
  try {
    const expeditionId = Number(req.query.expedition_id);
    await ensureExpeditionAccess(req.user, expeditionId);
    res.json({
      ticket: makeRealtimeTicket(req.user, expeditionId),
      expires_in: 60,
    });
  } catch (error) {
    next(error);
  }
});

router.get(
  '/users',
  authRequired,
  requireRole('commander'),
  async (req, res, next) => {
    try {
      res.json(
        await all(
          `SELECT id,organization_id,email,name,role,active,created_at
           FROM users
           WHERE organization_id=?
           ORDER BY name`,
          req.user.organization_id,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/users',
  authRequired,
  requireRole('commander'),
  async (req, res, next) => {
    try {
      requireFields(req.body, 'name', 'email', 'role', 'password');
      if (!['commander', 'logistics', 'field'].includes(req.body.role)) {
        throw new HttpError(400, 'Invalid role');
      }
      if (String(req.body.password).length < 8) {
        throw new HttpError(
          400,
          'Password must be at least 8 characters',
        );
      }

      const result = await run(
        `INSERT INTO users(
          organization_id,email,name,role,password_hash,active,created_at
        ) VALUES(?,?,?,?,?,?,?)`,
        req.user.organization_id,
        String(req.body.email).trim().toLowerCase(),
        req.body.name,
        req.body.role,
        hashPassword(String(req.body.password)),
        1,
        nowIso(),
      );

      res.status(201).json(
        await get(
          `SELECT id,organization_id,email,name,role,active,created_at
           FROM users WHERE id=?`,
          Number(result.lastInsertRowid),
        ),
      );
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        error = new HttpError(409, 'Email already exists');
      }
      next(error);
    }
  },
);

router.get('/organizations', authRequired, async (req, res, next) => {
  try {
    res.json(
      await all(
        'SELECT * FROM organizations WHERE id=?',
        req.user.organization_id,
      ),
    );
  } catch (error) {
    next(error);
  }
});

export default router;
