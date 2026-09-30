import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './config/env.js';
import { HttpError } from './http.js';

const TOKEN_HOURS = 12;

function signPayload(payload, secret = env.authSecret) {
  const raw = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(raw).digest('base64url');
  return `${raw}.${signature}`;
}

function decodeSignedPayload(token, secret = env.authSecret) {
  const [raw, signature] = String(token || '').split('.', 2);
  if (!raw || !signature) throw new Error('Malformed token');
  const expected = createHmac('sha256', secret).update(raw).digest();
  const received = Buffer.from(signature, 'base64url');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error('Bad signature');
  const payload = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  if (Number(payload.exp || 0) < Math.floor(Date.now() / 1000)) throw new Error('Expired');
  return payload;
}

export function hashPassword(password, rounds = 100000) {
  const salt = randomBytes(16);
  const digest = pbkdf2Sync(password, salt, rounds, 32, 'sha256');
  return `pbkdf2_sha256$${rounds}$${salt.toString('base64url')}$${digest.toString('base64url')}`;
}

export function verifyPassword(password, encoded) {
  try {
    const [algorithm, roundsRaw, saltRaw, digestRaw] = String(encoded).split('$');
    if (algorithm !== 'pbkdf2_sha256') return false;
    const rounds = Number(roundsRaw);
    const salt = Buffer.from(saltRaw, 'base64url');
    const expected = Buffer.from(digestRaw, 'base64url');
    const actual = pbkdf2Sync(password, salt, rounds, expected.length, 'sha256');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function makeToken(user, secret = env.authSecret) {
  return signPayload({
    uid: Number(user.id),
    oid: Number(user.organization_id),
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_HOURS * 3600,
  }, secret);
}

export function decodeToken(token, secret = env.authSecret) {
  try {
    return decodeSignedPayload(token, secret);
  } catch {
    throw new HttpError(401, 'Invalid or expired session');
  }
}

export function makeRealtimeTicket(
  user,
  expeditionId,
  ttlSeconds = 60,
  secret = env.authSecret,
) {
  return signPayload({
    uid: Number(user.id),
    oid: Number(user.organization_id),
    eid: Number(expeditionId),
    purpose: 'expedition_ws',
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }, secret);
}

export function decodeRealtimeTicket(ticket, secret = env.authSecret) {
  const payload = decodeSignedPayload(ticket, secret);
  if (payload.purpose !== 'expedition_ws') throw new Error('Wrong realtime ticket purpose');
  return payload;
}
