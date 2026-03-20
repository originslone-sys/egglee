exports.up = function (knex) {
  return knex.schema.alterTable('chickens', (t) => {
    t.decimal('egg_accumulator', 10, 6).defaultTo(0).notNullable()
      .comment('Fractional egg counter — when >= 1.0 an egg is produced');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('chickens', (t) => {
    t.dropColumn('egg_accumulator');
  });
};
