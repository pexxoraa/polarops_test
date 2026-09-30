import cors from 'cors';
import express from 'express';
import healthRoutes from '../routes/health.js';
import authRoutes from '../routes/auth.js';
import expeditionRoutes from '../routes/expeditions.js';
import dashboardRoutes from '../routes/dashboard.js';
import personnelRoutes from '../routes/personnel.js';
import telemetryRoutes from '../routes/telemetry.js';
import cargoRoutes from '../routes/cargo.js';
import inventoryRoutes from '../routes/inventory.js';
import vehicleRoutes from '../routes/vehicles.js';
import assetRoutes from '../routes/assets.js';
import incidentRoutes from '../routes/incidents.js';
import operationsRoutes from '../routes/operations.js';
import referenceRoutes from '../routes/reference.js';
import environmentRoutes from '../routes/environment.js';
import activityRoutes from '../routes/activity.js';
import backupRoutes from '../routes/backup.js';
import integrationsRoutes from '../routes/integrations.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { env } from './config/env.js';

function corsOrigin(origin, callback) {
  if (!origin) {
    callback(null, true);
    return;
  }

  const local =
    /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin);
  const configured = env.frontendOrigin && origin === env.frontendOrigin;
  const pagesPreview =
    /^https:\/\/[a-z0-9-]+\.polarops\.pages\.dev$/i.test(origin);

  callback(null, Boolean(local || configured || pagesPreview));
}

export function createApp() {
  const app=express();
  app.disable('x-powered-by');
  app.use(cors({origin:corsOrigin,credentials:false}));
  app.use(express.json({limit:'2mb'}));
  app.use('/api/health',healthRoutes);
  app.use('/api',authRoutes);
  app.use('/api',referenceRoutes);
  app.use('/api',expeditionRoutes);
  app.use('/api/dashboard',dashboardRoutes);
  app.use('/api/personnel',personnelRoutes);
  app.use('/api/telemetry',telemetryRoutes);
  app.use('/api/cargo',cargoRoutes);
  app.use('/api/inventory',inventoryRoutes);
  app.use('/api/vehicles',vehicleRoutes);
  app.use('/api/assets',assetRoutes);
  app.use('/api/incidents',incidentRoutes);
  app.use('/api/ops',operationsRoutes);
  app.use('/api/environment',environmentRoutes);
  app.use('/api/activity',activityRoutes);
  app.use('/api/backup',backupRoutes);
  app.use('/api/integrations',integrationsRoutes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
