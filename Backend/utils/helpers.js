export const nowIso = () => new Date().toISOString();

export function pickDefined(source, keys) {
  return Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
}

export function asId(value, label = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error(`Invalid ${label}`);
    error.status = 400;
    throw error;
  }
  return id;
}

export function normalizeBoolean(value) {
  return value === true || value === 1 || value === '1' ? 1 : 0;
}
