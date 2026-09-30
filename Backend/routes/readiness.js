import { Router } from 'express';
import { all } from '../utils/config/database.js';
import { authRequired } from '../utils/middleware/auth.js';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res, next) => {
  try {
    const expeditionId = req.query.expedition_id;

    // SQL join with teams table
    const rows = await all(
      `SELECT r.*, t.name AS team_name, t.size AS team_size
       FROM readiness_items r
       LEFT JOIN teams t ON t.id = r.team_id
       WHERE r.expedition_id = ?
       ORDER BY t.name, r.category`,
      expeditionId
    );

    // Group by team
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.team_id]) {
        grouped[row.team_id] = {
          team_name: row.team_name,
          team_size: row.team_size,
          items: []
        };
      }
      grouped[row.team_id].items.push(row);
    }

    res.json(Object.values(grouped));
  } catch (error) {
    next(error);
  }
});

export default router;
