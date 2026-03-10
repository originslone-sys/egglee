exports.up = function (knex) {
  return knex.schema.createTable('deposits', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.string('tx_hash', 66).notNullable().unique();
    t.string('from_address', 42).notNullable();
    t.string('to_address', 42).notNullable();
    t.decimal('amount', 18, 2).notNullable();
    t.integer('block_number').unsigned().notNullable();
    t.integer('confirmations').unsigned().defaultTo(0).notNullable();
    t.enum('status', ['pending', 'confirmed', 'failed']).defaultTo('pending').notNullable();
    t.timestamp('confirmed_at').nullable();
    t.timestamps(true, true);

    t.index(['status']);
    t.index(['to_address']);
    t.index(['user_id', 'status']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('deposits');
};
