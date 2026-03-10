exports.up = function (knex) {
  return knex.schema.createTable('chickens', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('species_id').unsigned().notNullable().references('id').inTable('chicken_species');
    t.enum('status', ['alive', 'dead']).defaultTo('alive').notNullable();
    t.boolean('is_free_chicken').defaultTo(false).notNullable().comment('True if given at onboarding');
    t.timestamp('born_at').notNullable();
    t.timestamp('dies_at').notNullable().comment('born_at + lifespan_days');
    t.timestamp('starvation_started_at').nullable().comment('Set when feed runs out, cleared when fed');
    t.timestamp('died_at').nullable();
    t.enum('death_cause', ['lifespan', 'starvation']).nullable();
    t.timestamps(true, true);

    t.index(['user_id', 'status']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('chickens');
};
