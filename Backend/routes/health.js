import { Router } from 'express';
import {
  migrationCount,
  usingD1,
} from '../utils/config/database.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    res.json({
      ok: true,
      service: 'polarops-backend',
      database: usingD1() ? 'd1' : 'sqlite',
      migrations: await migrationCount(),
      time: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
