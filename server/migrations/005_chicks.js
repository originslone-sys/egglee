exports.up = function (knex) {
  return knex.schema.createTable('chicks', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('egg_id').unsigned().notNullable().references('id').inTable('eggs');
    t.integer('target_species_id').unsigned().notNullable().references('id').inTable('chicken_species').comment('Species determined at hatch by probability roll');
    t.string('status', 10).defaultTo('growing').notNullable();
    t.decimal('feed_consumed', 8, 2).defaultTo(0).notNullable().comment('Accumulates feed; needs 2.0 to become adult');
    t.timestamp('hatched_at').notNullable();
    t.timestamp('adult_at').nullable().comment('hatched_at + 12 days');
    t.timestamps(true, true);

    t.index(['user_id', 'status']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('chicks');
};
