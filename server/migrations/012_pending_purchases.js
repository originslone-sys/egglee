exports.up = function (knex) {
  return knex.schema.createTable('pending_purchases', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('tx_hash', 66).notNullable().unique();
    t.string('purchase_type', 20).notNullable(); // 'feed' or 'chicken'
    t.json('purchase_data').notNullable(); // { quantity } or { species_id }
    t.decimal('expected_amount', 18, 2).notNullable();
    t.string('from_address', 42).notNullable();
    t.integer('block_number').unsigned().defaultTo(0).notNullable();
    t.integer('confirmations').unsigned().defaultTo(0).notNullable();
    t.string('status', 15).defaultTo('pending').notNullable(); // pending, confirmed, failed
    t.timestamp('confirmed_at').nullable();
    t.timestamps(true, true);

    t.index(['status']);
    t.index(['user_id', 'status']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('pending_purchases');
};
