exports.up = function (knex) {
  return knex.schema.createTable('eggs', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('chicken_id').unsigned().nullable().references('id').inTable('chickens').onDelete('SET NULL');
    t.string('status', 20).defaultTo('available').notNullable();
    t.boolean('is_fertile').defaultTo(false).notNullable();
    t.timestamp('produced_at').notNullable();
    t.timestamp('collected_at').nullable();
    t.timestamp('incubation_started_at').nullable();
    t.timestamp('hatched_at').nullable();
    t.timestamps(true, true);

    t.index(['user_id', 'status']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('eggs');
};
