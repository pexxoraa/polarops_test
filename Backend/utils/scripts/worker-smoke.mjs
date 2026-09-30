import assert from 'node:assert/strict';
import WebSocket from 'ws';

const base = process.env.POLAROPS_WORKER_URL || 'http://127.0.0.1:8787';

const healthResponse = await fetch(base + '/api/health');
assert.equal(healthResponse.status, 200);
const health = await healthResponse.json();
assert.equal(health.ok, true);
assert.equal(health.database, 'd1');
assert.equal(Number(health.migrations), 12);

const loginResponse = await fetch(base + '/api/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    email: 'commander@polarops.local',
    password: 'PolarOps123!',
  }),
});
assert.equal(loginResponse.status, 200);
const login = await loginResponse.json();
assert.ok(login.token);

const bootstrapResponse = await fetch(base + '/api/bootstrap', {
  headers: { authorization: 'Bearer ' + login.token },
});
assert.equal(bootstrapResponse.status, 200);
const bootstrap = await bootstrapResponse.json();
assert.equal(bootstrap.user.email, 'commander@polarops.local');
assert.equal(bootstrap.expeditions.length, 2);

const ticketResponse = await fetch(
  base + '/api/realtime/ticket?expedition_id=1',
  {
    headers: { authorization: 'Bearer ' + login.token },
  },
);
assert.equal(ticketResponse.status, 200);
const { ticket } = await ticketResponse.json();

const wsUrl =
  base.replace(/^http/i, 'ws') +
  '/ws/expeditions/1?ticket=' +
  encodeURIComponent(ticket);

const authMessage = await new Promise((resolve, reject) => {
  const socket = new WebSocket(wsUrl);
  const timer = setTimeout(
    () => reject(new Error('Worker WebSocket timeout')),
    5000,
  );

  socket.on('open', () => {
    socket.send(
      JSON.stringify({
        type: 'auth',
        token: login.token,
      }),
    );
  });

  socket.on('message', (data) => {
    clearTimeout(timer);
    const message = JSON.parse(data.toString());
    socket.close();
    resolve(message);
  });

  socket.on('error', reject);
});

assert.equal(authMessage.type, 'auth.ok');
assert.equal(authMessage.expedition_id, 1);

console.log(
  JSON.stringify({
    ok: true,
    database: health.database,
    migrations: health.migrations,
    expeditions: bootstrap.expeditions.length,
    realtime: authMessage.type,
    url: base,
  }),
);
