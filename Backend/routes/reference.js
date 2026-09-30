import { Router } from 'express';
import {
  all,
  get,
  seedFacilitiesSnapshot,
} from '../utils/config/database.js';
import { authRequired } from '../utils/middleware/auth.js';
import { requirePermission } from '../utils/middleware/permissions.js';
import { HttpError } from '../utils/http.js';

const router = Router();

router.get('/public/facilities', async (req, res, next) => {
  try {
    const rows = await all(
      `SELECT id,source_key,name,country,programme,facility_type,
        seasonality,status,latitude,longitude,source,source_url,
        source_updated_at,synced_at
       FROM public_facilities
       ORDER BY country,name`,
    );
    res.json(
      rows.map((row) => ({
        ...row,
        data_kind: 'reference',
        live: false,
      })),
    );
  } catch (error) {
    next(error);
  }
});

router.get(
  '/public/research-stations-reference',
  async (req, res, next) => {
    try {
      res.json({
        source_title: 'COMNAP Research Stations Map',
        source_period: '1998-2005',
        data_kind: 'historical_reference',
        live: false,
        items: await all(
          'SELECT * FROM research_station_reference ORDER BY map_number',
        ),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/public/arctic-research-stations',
  async (req, res, next) => {
    try {
      res.json({
        data_kind: 'reference_with_verification',
        live: false,
        items: await all(
          'SELECT * FROM arctic_research_stations ORDER BY name',
        ),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/data-sources',
  authRequired,
  requirePermission('facilities.read'),
  async (req, res, next) => {
    try {
      res.json(await all('SELECT * FROM data_sources ORDER BY name'));
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/public/facilities/sync',
  authRequired,
  requirePermission('facilities.manage'),
  async (req, res, next) => {
    try {
      await seedFacilitiesSnapshot(undefined, true);
      const count = Number(
        (
          await get(
            'SELECT COUNT(*) count FROM public_facilities',
          )
        )?.count || 0,
      );
      res.json({
        ok: true,
        count,
        source: 'bundled November 2024 COMNAP snapshot',
        live: false,
        note:
          'Cloudflare D1 is seeded through migrations; local development can reload the bundled snapshot.',
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/public/facilities/:id/weather',
  authRequired,
  requirePermission('facilities.read'),
  async (req, res, next) => {
    try {
      const facility = await get(
        'SELECT * FROM public_facilities WHERE id=?',
        Number(req.params.id),
      );
      if (!facility) {
        throw new HttpError(404, 'Facility not found');
      }
      const cached = await get(
        'SELECT * FROM facility_weather WHERE facility_id=?',
        facility.id,
      );
      res.json({
        facility,
        cached_weather: cached || null,
        live: false,
        note:
          'Use the expedition environment endpoint for optional live weather fetches.',
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/public/facilities/:id/import',
  authRequired,
  requirePermission('facilities.manage'),
  async (req, res, next) => {
    try {
      const facility = await get(
        'SELECT * FROM public_facilities WHERE id=?',
        Number(req.params.id),
      );
      if (!facility) {
        throw new HttpError(404, 'Facility not found');
      }
      res.status(501).json({
        error:
          'Import remains disabled until an explicit expedition/location mapping is provided.',
        facility,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
