exports.seed = async function (knex) {
  await knex('chicken_species').del();

  await knex('chicken_species').insert([
    {
      name: 'Comum',
      purchase_price: 1.20,
      eggs_per_day: 1.0,
      feed_per_day: 0.8,
      lifespan_days: 183,
      hatch_probability: 0.7000,
      species_weight: 0.7000,
    },
    {
      name: 'Premium',
      purchase_price: 3.00,
      eggs_per_day: 2.3,
      feed_per_day: 1.4,
      lifespan_days: 210,
      hatch_probability: 0.2500,
      species_weight: 0.2500,
    },
    {
      name: 'Rare',
      purchase_price: 7.00,
      eggs_per_day: 5.5,
      feed_per_day: 3.5,
      lifespan_days: 270,
      hatch_probability: 0.0500,
      species_weight: 0.0500,
    },
  ]);
};
