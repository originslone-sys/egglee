exports.up = function (knex) {
  return knex.schema.createTable('wallet_ledger', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('type', 30).notNullable();
    t.decimal('amount', 18, 2).notNullable().comment('Positive = credit, negative = debit');
    t.decimal('balance_after', 18, 2).notNullable();
    t.string('reference_id', 100).nullable().comment('Related entity ID or tx hash');
    t.text('description').nullable();
    t.timestamps(true, true);

    t.index(['user_id', 'created_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('wallet_ledger');
};
