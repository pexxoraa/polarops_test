import { HttpError } from '../http.js';

const ROLE_PERMISSIONS = {
  commander: new Set(['*']),
  logistics: new Set([
    'dashboard.read','expeditions.read','locations.manage','personnel.read','personnel.manage','personnel.checkin',
    'cargo.read','cargo.manage','inventory.read','inventory.manage','vehicles.read','vehicles.manage','assets.read','assets.manage',
    'incidents.read','incidents.manage','routes.read','routes.manage','operations.read','operations.manage','science.manage',
    'facilities.read','facilities.manage','environment.read','audit.read','telemetry.manage',
  ]),
  field: new Set([
    'dashboard.read','expeditions.read','personnel.read','personnel.checkin','cargo.read','inventory.read','vehicles.read','assets.read',
    'incidents.read','incidents.create','routes.read','operations.read','science.manage','facilities.read','environment.read','audit.read','telemetry.manage',
  ]),
};

export function hasPermission(user, permission) {
  const permissions = ROLE_PERMISSIONS[user?.role] || new Set();
  return permissions.has('*') || permissions.has(permission);
}

export function requirePermission(permission) {
  return (req, res, next) => {
    try {
      if (!hasPermission(req.user, permission)) throw new HttpError(403, 'Permission denied');
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(...roles) {
  return (req, res, next) => {
    try {
      if (!roles.includes(req.user?.role)) throw new HttpError(403, 'Permission denied');
      next();
    } catch (error) {
      next(error);
    }
  };
}
