exports.up = function (knex) {
  return knex.schema.alterTable('chickens', (t) => {
    t.string('name', 30).nullable().after('species_id');
    t.decimal('total_feed_consumed', 12, 2).defaultTo(0).notNullable().after('starvation_started_at');
    t.integer('total_eggs_produced').defaultTo(0).notNullable().after('total_feed_consumed');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('chickens', (t) => {
    t.dropColumn('name');
    t.dropColumn('total_feed_consumed');
    t.dropColumn('total_eggs_produced');
  });
};
