import { Router } from 'express';
import { authRequired } from '../utils/middleware/auth.js';
import { requirePermission } from '../utils/middleware/permissions.js';
import { ensureExpeditionAccess } from '../utils/validation.js';
import { environmentOverview } from '../utils/services/environmentService.js';

const router = Router();

router.get(
  '/overview',
  authRequired,
  requirePermission('environment.read'),
  async (req, res, next) => {
    try {
      const expedition = await ensureExpeditionAccess(
        req.user,
        req.query.expedition_id,
      );
      res.json(
        await environmentOverview(
          expedition,
          String(req.query.force || '') === '1',
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

export default router;
