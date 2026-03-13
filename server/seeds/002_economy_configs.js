exports.seed = async function (knex) {
  await knex('economy_configs').del();

  await knex('economy_configs').insert([
    { key: 'egg_system_price', value: '0.10', description: 'Price the system pays per egg when selling (USDT)' },
    { key: 'egg_purchase_price', value: '0.15', description: 'Price per egg when buying via MetaMask (USDT)' },
    { key: 'feed_unit_price', value: '0.12', description: 'Price per feed unit (USDT)' },
    { key: 'withdrawal_fee_rate', value: '0.03', description: 'Withdrawal fee rate (3%)' },
    { key: 'withdrawal_min_amount', value: '0', description: 'Minimum withdrawal amount (USDT)' },
    { key: 'withdrawal_sla_hours', value: '72', description: 'Withdrawal processing SLA in hours' },
    { key: 'allow_new_registrations', value: 'true', description: 'Global toggle for new user registrations' },
    { key: 'onboarding_free_feed', value: '5', description: 'Free feed units given to new users' },
    { key: 'starvation_death_hours', value: '72', description: 'Hours without feed before chicken dies' },
    { key: 'egg_incubation_hours', value: '72', description: 'Hours for egg to complete incubation' },
    { key: 'egg_hatch_success_rate', value: '0.30', description: 'Success rate for egg hatching into chick (0.0 to 1.0)' },
    { key: 'chick_growth_days', value: '12', description: 'Days for chick to become adult chicken' },
    { key: 'egg_to_chick_feed', value: '0.7', description: 'Feed needed for egg to hatch' },
    { key: 'chick_to_adult_feed', value: '2.0', description: 'Feed needed for chick to become adult' },
    { key: 'bep20_confirmations', value: '12', description: 'Required BEP20 confirmations for deposits' },
    { key: 'compensation_feed_per_incident', value: '10', description: 'Free feed given per platform incident' },
    { key: 'max_withdrawals_per_day', value: '1', description: 'Max withdrawal requests per user per day' },
    {
      key: 'p2p_fee_tiers',
      value: JSON.stringify([
        { max_volume: 100, rate: 0.08 },
        { max_volume: 500, rate: 0.06 },
        { max_volume: 1500, rate: 0.045 },
        { max_volume: null, rate: 0.035 },
      ]),
      description: 'P2P marketplace fee tiers by monthly volume (USDT)',
    },
  ]);
};
