const db = require('../config/database');

const cache = new Map();
const CACHE_TTL = 60_000; // 1 minute

const EconomyConfig = {
  async get(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.value;

    const row = await db('economy_configs').where({ key }).first();
    if (!row) return null;

    const value = row.value;
    cache.set(key, { value, ts: Date.now() });
    return value;
  },

  async getNumber(key) {
    const val = await this.get(key);
    return val !== null ? parseFloat(val) : null;
  },

  async getBoolean(key) {
    const val = await this.get(key);
    return val === 'true';
  },

  async getJSON(key) {
    const val = await this.get(key);
    return val !== null ? JSON.parse(val) : null;
  },

  async set(key, value, adminId = null) {
    const existing = await db('economy_configs').where({ key }).first();
    const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    if (existing) {
      await db('economy_config_history').insert({
        config_key: key,
        old_value: existing.value,
        new_value: strValue,
        changed_by: adminId,
      });
      await db('economy_configs').where({ key }).update({ value: strValue, updated_by: adminId });
    } else {
      await db('economy_configs').insert({ key, value: strValue, updated_by: adminId });
    }

    cache.delete(key);
  },

  async getAll() {
    const rows = await db('economy_configs').select('*');
    const result = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  },

  clearCache() {
    cache.clear();
  },
};

module.exports = EconomyConfig;
