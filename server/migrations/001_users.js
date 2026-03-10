exports.up = function (knex) {
  return knex.schema.createTable('users', (t) => {
    t.increments('id').primary();
    t.string('wallet_address', 42).notNullable().unique();
    t.string('auth_nonce', 64).notNullable();
    t.enum('role', ['user', 'admin']).defaultTo('user').notNullable();
    t.boolean('is_banned').defaultTo(false).notNullable();
    t.decimal('balance_usdt', 18, 2).defaultTo(0).notNullable();
    t.decimal('feed_balance', 18, 2).defaultTo(0).notNullable();
    t.boolean('auto_feed_enabled').defaultTo(false).notNullable();
    t.boolean('accepted_terms').defaultTo(false).notNullable();
    t.timestamp('last_login_at').nullable();
    t.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('users');
};
