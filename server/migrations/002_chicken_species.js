exports.up = function (knex) {
  return knex.schema.createTable('chicken_species', (t) => {
    t.increments('id').primary();
    t.string('name', 50).notNullable().unique();
    t.decimal('purchase_price', 18, 2).notNullable();
    t.decimal('eggs_per_day', 8, 2).notNullable();
    t.decimal('feed_per_day', 8, 2).notNullable();
    t.integer('lifespan_days').notNullable();
    t.decimal('hatch_probability', 5, 4).notNullable().comment('Probability 0.0000–1.0000 when egg hatches into this species');
    t.boolean('is_active').defaultTo(true).notNullable();
    t.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('chicken_species');
};
