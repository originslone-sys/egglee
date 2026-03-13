exports.up = function (knex) {
  return knex.schema.alterTable('chicken_species', (t) => {
    t.decimal('species_weight', 5, 4).notNullable().defaultTo(0).after('hatch_probability')
      .comment('Relative weight for species selection when egg hatches into chick');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('chicken_species', (t) => {
    t.dropColumn('species_weight');
  });
};
