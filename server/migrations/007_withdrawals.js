exports.up = function (knex) {
  return knex.schema.createTable('withdrawals', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.decimal('amount', 18, 2).notNullable();
    t.decimal('fee_amount', 18, 2).notNullable();
    t.decimal('net_amount', 18, 2).notNullable().comment('amount - fee_amount');
    t.string('wallet_address', 42).notNullable();
    t.string('status', 15).defaultTo('pending').notNullable();
    t.string('tx_hash', 66).nullable();
    t.integer('processed_by').unsigned().nullable().references('id').inTable('users').comment('Admin who processed');
    t.text('admin_note').nullable();
    t.timestamp('processed_at').nullable();
    t.timestamps(true, true);

    t.index(['user_id', 'status']);
    t.index(['status', 'created_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('withdrawals');
};
