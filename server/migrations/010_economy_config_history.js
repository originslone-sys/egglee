exports.up = function (knex) {
  return knex.schema.createTable('economy_config_history', (t) => {
    t.increments('id').primary();
    t.string('config_key', 100).notNullable();
    t.text('old_value').nullable();
    t.text('new_value').notNullable();
    t.integer('changed_by').unsigned().nullable().references('id').inTable('users');
    t.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    t.index(['config_key', 'created_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('economy_config_history');
};
