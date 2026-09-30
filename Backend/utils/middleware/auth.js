import { get } from '../config/database.js';
import { decodeToken } from '../security.js';
import { HttpError } from '../http.js';

export async function authRequired(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ')
      ? header.slice(7).trim()
      : '';
    if (!token) throw new HttpError(401, 'Authentication required');

    const payload = decodeToken(token);
    const user = await get(
      `SELECT id,organization_id,email,name,role,active,created_at
       FROM users WHERE id=? AND active=1`,
      Number(payload.uid),
    );
    if (
      !user ||
      Number(user.organization_id) !== Number(payload.oid)
    ) {
      throw new HttpError(401, 'Invalid or inactive session');
    }

    req.user = user;
    req.authToken = token;
    next();
  } catch (error) {
    next(error);
  }
}
