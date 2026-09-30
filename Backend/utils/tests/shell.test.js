import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../config/database.js';

test('local SQLite migrations and reference seeds initialize', async () => {
  const db = await createDatabase(':memory:');
  const migrations = Number(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count);
  const users = Number(db.prepare('SELECT COUNT(*) AS count FROM users').get().count);
  const expeditions = Number(db.prepare('SELECT COUNT(*) AS count FROM expeditions').get().count);
  const facilities = Number(db.prepare('SELECT COUNT(*) AS count FROM public_facilities').get().count);
  assert.ok(migrations >= 10);
  assert.equal(users, 3);
  assert.equal(expeditions, 2);
  assert.ok(facilities > 50);
  db.close();
});
