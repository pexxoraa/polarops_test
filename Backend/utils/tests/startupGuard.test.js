import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { detectBackendOnPort } from '../startupGuard.js';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

test('detects an existing PolarOps backend', async () => {
  const server = http.createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ service: 'polarops-backend' }));
  });
  const port = await listen(server);

  assert.equal(await detectBackendOnPort(port), 'polarops');
  await close(server);
});

test('detects an unrelated application', async () => {
  const server = http.createServer((request, response) => {
    response.end('another service');
  });
  const port = await listen(server);

  assert.equal(await detectBackendOnPort(port), 'occupied');
  await close(server);
});

test('detects a free port', async () => {
  const server = http.createServer();
  const port = await listen(server);
  await close(server);

  assert.equal(await detectBackendOnPort(port), 'free');
});
