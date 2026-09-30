import { all, get, run } from '../utils/config/database.js';

export function createModel({ table, fields }) {
  const allowed = new Set(fields);
  const filter = (data) =>
    Object.fromEntries(
      Object.entries(data || {}).filter(
        ([key, value]) => allowed.has(key) && value !== undefined,
      ),
    );

  return {
    table,

    async getById(id) {
      return get(`SELECT * FROM ${table} WHERE id=?`, Number(id));
    },

    async listByExpedition(expeditionId, orderBy = 'id DESC') {
      return all(
        `SELECT * FROM ${table} WHERE expedition_id=? ORDER BY ${orderBy}`,
        Number(expeditionId),
      );
    },

    async create(data) {
      const clean = filter(data);
      const keys = Object.keys(clean);
      const placeholders = keys.map(() => '?').join(',');
      const result = await run(
        `INSERT INTO ${table}(${keys.join(',')}) VALUES(${placeholders})`,
        ...keys.map((key) => clean[key]),
      );
      return this.getById(Number(result.lastInsertRowid));
    },

    async update(id, data) {
      const clean = filter(data);
      const keys = Object.keys(clean);
      if (!keys.length) return this.getById(id);
      await run(
        `UPDATE ${table} SET ${keys
          .map((key) => `${key}=?`)
          .join(',')} WHERE id=?`,
        ...keys.map((key) => clean[key]),
        Number(id),
      );
      return this.getById(id);
    },

    async delete(id) {
      return run(`DELETE FROM ${table} WHERE id=?`, Number(id));
    },
  };
}
