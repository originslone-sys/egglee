exports.up = function (knex) {
  return knex.schema.createTable('economy_configs', (t) => {
    t.increments('id').primary();
    t.string('key', 100).notNullable().unique();
    t.text('value').notNullable();
    t.string('description', 255).nullable();
    t.integer('updated_by').unsigned().nullable().references('id').inTable('users');
    t.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('economy_configs');
};
