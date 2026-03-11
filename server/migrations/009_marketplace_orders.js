exports.up = function (knex) {
  return knex.schema.createTable('marketplace_orders', (t) => {
    t.increments('id').primary();
    t.integer('seller_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('buyer_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.string('item_type', 10).notNullable();
    t.integer('item_id').unsigned().notNullable();
    t.decimal('price', 18, 2).notNullable();
    t.decimal('fee_rate', 5, 4).notNullable().comment('P2P fee rate applied at time of sale');
    t.decimal('fee_amount', 18, 2).nullable();
    t.string('status', 15).defaultTo('listed').notNullable();
    t.timestamp('sold_at').nullable();
    t.timestamps(true, true);

    t.index(['status', 'item_type']);
    t.index(['seller_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('marketplace_orders');
};
