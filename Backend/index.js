import http from 'node:http';
import { assertRuntimeConfig, env } from './utils/config/env.js';
import { initDatabase } from './utils/config/database.js';
import { createApp } from './utils/app.js';
import { configureRealtime } from './utils/services/localRealtimeService.js';
import { detectBackendOnPort } from './utils/startupGuard.js';

const host = '127.0.0.1';
let app;
let server;

async function startBackend() {
  const portState = await detectBackendOnPort(env.port, host);

  if (portState === 'polarops') {
    console.log(
      `PolarOps backend is already running on http://${host}:${env.port}`,
    );
    return;
  }

  if (portState === 'occupied') {
    console.error(
      `Port ${env.port} is already in use by another application. ` +
        'Stop that process or change PORT in Backend/.env.',
    );
    process.exitCode = 1;
    return;
  }

  assertRuntimeConfig();
  await initDatabase();
  app = createApp();
  server = http.createServer(app);
  configureRealtime(server);

  server.on('error', async (error) => {
    if (error.code !== 'EADDRINUSE') {
      console.error('PolarOps backend failed to start:', error);
      process.exitCode = 1;
      return;
    }

    const state = await detectBackendOnPort(env.port, host);
    if (state === 'polarops') {
      console.log(
        `PolarOps backend is already running on http://${host}:${env.port}`,
      );
      return;
    }

    console.error(
      `Port ${env.port} became unavailable before startup completed. ` +
        'Stop the other application or change PORT in Backend/.env.',
    );
    process.exitCode = 1;
  });

  server.listen(env.port, host, () => {
    console.log(
      `PolarOps backend listening on http://${host}:${env.port}`,
    );
  });
}

await startBackend();

export { app, server };
