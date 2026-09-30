import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../config/database.js';
import { decodeToken, makeRealtimeTicket, makeToken, verifyPassword } from '../security.js';

test('demo password hashes remain compatible with Node PBKDF2', async () => {
  const db = await createDatabase(':memory:');
  const commander = db.prepare('SELECT * FROM users WHERE email=?').get('commander@polarops.local');
  const logistics = db.prepare('SELECT * FROM users WHERE email=?').get('logistics@polarops.local');
  const field = db.prepare('SELECT * FROM users WHERE email=?').get('field@polarops.local');
  assert.equal(verifyPassword('PolarOps123!', commander.password_hash), true);
  assert.equal(verifyPassword('Logistics123!', logistics.password_hash), true);
  assert.equal(verifyPassword('Field123!', field.password_hash), true);
  db.close();
});

test('session and realtime tickets carry tenant-scoped identity', () => {
  const user = { id: 7, organization_id: 3, email: 'x@example.test', role: 'logistics' };
  const token = makeToken(user);
  const payload = decodeToken(token);
  assert.equal(payload.uid, 7);
  assert.equal(payload.oid, 3);
  const ticket = makeRealtimeTicket(user, 22);
  assert.ok(ticket.includes('.'));
});
