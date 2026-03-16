/**
 * Add missing indexes for production-scale performance.
 * Covers: date-range filters, JOIN columns, status lookups.
 */
exports.up = function (knex) {
  return Promise.all([
    // ── chickens: species_id used in JOINs, dies_at for expiry checks ──
    knex.schema.alterTable('chickens', (t) => {
      t.index(['species_id']);
      t.index(['status', 'dies_at']);
      t.index(['user_id', 'status', 'dies_at']);
    }),

    // ── eggs: chicken_id used in JOINs, produced_at for date queries ──
    knex.schema.alterTable('eggs', (t) => {
      t.index(['chicken_id']);
    }),

    // ── pending_purchases: confirmed_at for date-range stats ──
    knex.schema.alterTable('pending_purchases', (t) => {
      t.index(['status', 'confirmed_at']);
    }),

    // ── withdrawals: processed_at for date-range stats ──
    knex.schema.alterTable('withdrawals', (t) => {
      t.index(['status', 'processed_at']);
    }),

    // ── deposits: block_number for monitor scanning ──
    knex.schema.alterTable('deposits', (t) => {
      t.index(['status', 'block_number']);
    }),

    // ── marketplace_orders: buyer_id for purchase history ──
    knex.schema.alterTable('marketplace_orders', (t) => {
      t.index(['buyer_id']);
      t.index(['status', 'created_at']);
    }),

    // ── wallet_ledger: type for filtered queries ──
    knex.schema.alterTable('wallet_ledger', (t) => {
      t.index(['user_id', 'type']);
    }),
  ]);
};

exports.down = function (knex) {
  return Promise.all([
    knex.schema.alterTable('chickens', (t) => {
      t.dropIndex(['species_id']);
      t.dropIndex(['status', 'dies_at']);
      t.dropIndex(['user_id', 'status', 'dies_at']);
    }),
    knex.schema.alterTable('eggs', (t) => {
      t.dropIndex(['chicken_id']);
    }),
    knex.schema.alterTable('pending_purchases', (t) => {
      t.dropIndex(['status', 'confirmed_at']);
    }),
    knex.schema.alterTable('withdrawals', (t) => {
      t.dropIndex(['status', 'processed_at']);
    }),
    knex.schema.alterTable('deposits', (t) => {
      t.dropIndex(['status', 'block_number']);
    }),
    knex.schema.alterTable('marketplace_orders', (t) => {
      t.dropIndex(['buyer_id']);
      t.dropIndex(['status', 'created_at']);
    }),
    knex.schema.alterTable('wallet_ledger', (t) => {
      t.dropIndex(['user_id', 'type']);
    }),
  ]);
};
