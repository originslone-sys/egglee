const { Router } = require('express');
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const EconomyConfig = require('../models/EconomyConfig');

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

// GET /api/admin/dashboard — overview stats for admin homepage
router.get('/dashboard', async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    purchasesTotal, purchasesToday, purchasesMonth,
    withdrawalsTotal, withdrawalsToday, withdrawalsMonth,
    depositsTotal, depositsToday, depositsMonth,
    totalUsers, activeChickens, totalEggs,
  ] = await Promise.all([
    // Purchases (confirmed only)
    db('pending_purchases').where({ status: 'confirmed' }).sum('expected_amount as total').first(),
    db('pending_purchases').where({ status: 'confirmed' }).where('confirmed_at', '>=', todayStart).sum('expected_amount as total').first(),
    db('pending_purchases').where({ status: 'confirmed' }).where('confirmed_at', '>=', monthStart).sum('expected_amount as total').first(),
    // Withdrawals (completed only)
    db('withdrawals').where({ status: 'completed' }).sum('net_amount as total').first(),
    db('withdrawals').where({ status: 'completed' }).where('processed_at', '>=', todayStart).sum('net_amount as total').first(),
    db('withdrawals').where({ status: 'completed' }).where('processed_at', '>=', monthStart).sum('net_amount as total').first(),
    // Deposits (confirmed only)
    db('deposits').where({ status: 'confirmed' }).sum('amount as total').first(),
    db('deposits').where({ status: 'confirmed' }).where('confirmed_at', '>=', todayStart).sum('amount as total').first(),
    db('deposits').where({ status: 'confirmed' }).where('confirmed_at', '>=', monthStart).sum('amount as total').first(),
    // Counters
    db('users').count('id as count').first(),
    db('chickens').where({ status: 'alive' }).count('id as count').first(),
    db('eggs').whereIn('status', ['available', 'incubating']).count('id as count').first(),
  ]);

  const pendingWithdrawals = await db('withdrawals').where({ status: 'pending' }).count('id as count').first();
  const purchasesCount = await db('pending_purchases').where({ status: 'confirmed' }).count('id as count').first();

  res.json({
    purchases: {
      total: parseFloat(purchasesTotal.total) || 0,
      today: parseFloat(purchasesToday.total) || 0,
      month: parseFloat(purchasesMonth.total) || 0,
      count: parseInt(purchasesCount.count, 10),
    },
    withdrawals: {
      total: parseFloat(withdrawalsTotal.total) || 0,
      today: parseFloat(withdrawalsToday.total) || 0,
      month: parseFloat(withdrawalsMonth.total) || 0,
      pending: parseInt(pendingWithdrawals.count, 10),
    },
    deposits: {
      total: parseFloat(depositsTotal.total) || 0,
      today: parseFloat(depositsToday.total) || 0,
      month: parseFloat(depositsMonth.total) || 0,
    },
    users: parseInt(totalUsers.count, 10),
    active_chickens: parseInt(activeChickens.count, 10),
    total_eggs: parseInt(totalEggs.count, 10),
  });
});

// GET /api/admin/purchases/stats — purchase statistics with best sellers
router.get('/purchases/stats', async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Overall purchase stats by type
  const byType = await db('pending_purchases')
    .where({ status: 'confirmed' })
    .select('purchase_type')
    .count('id as count')
    .sum('expected_amount as total')
    .groupBy('purchase_type');

  // Today's stats by type
  const byTypeToday = await db('pending_purchases')
    .where({ status: 'confirmed' })
    .where('confirmed_at', '>=', todayStart)
    .select('purchase_type')
    .count('id as count')
    .sum('expected_amount as total')
    .groupBy('purchase_type');

  // Month stats by type
  const byTypeMonth = await db('pending_purchases')
    .where({ status: 'confirmed' })
    .where('confirmed_at', '>=', monthStart)
    .select('purchase_type')
    .count('id as count')
    .sum('expected_amount as total')
    .groupBy('purchase_type');

  // Best selling species (chickens purchased)
  const topSpecies = await db('pending_purchases')
    .where({ status: 'confirmed', purchase_type: 'chicken' })
    .select(db.raw("JSON_UNQUOTE(JSON_EXTRACT(purchase_data, '$.species_id')) as species_id"))
    .count('id as count')
    .sum('expected_amount as total')
    .groupBy('species_id')
    .orderBy('count', 'desc')
    .limit(10);

  // Get species names
  const speciesIds = topSpecies.map(s => s.species_id).filter(Boolean);
  let speciesMap = {};
  if (speciesIds.length > 0) {
    const speciesList = await db('chicken_species').whereIn('id', speciesIds).select('id', 'name');
    speciesMap = speciesList.reduce((acc, s) => { acc[s.id] = s.name; return acc; }, {});
  }

  // Recent purchases (last 50)
  const recent = await db('pending_purchases')
    .where({ status: 'confirmed' })
    .leftJoin('users', 'pending_purchases.user_id', 'users.id')
    .select(
      'pending_purchases.*',
      'users.wallet_address as user_wallet'
    )
    .orderBy('pending_purchases.confirmed_at', 'desc')
    .limit(50);

  // Totals
  const totals = await db('pending_purchases')
    .where({ status: 'confirmed' })
    .count('id as count')
    .sum('expected_amount as total')
    .first();

  const totalToday = await db('pending_purchases')
    .where({ status: 'confirmed' })
    .where('confirmed_at', '>=', todayStart)
    .count('id as count')
    .sum('expected_amount as total')
    .first();

  const totalMonth = await db('pending_purchases')
    .where({ status: 'confirmed' })
    .where('confirmed_at', '>=', monthStart)
    .count('id as count')
    .sum('expected_amount as total')
    .first();

  const formatByType = (arr) => arr.reduce((acc, r) => {
    acc[r.purchase_type] = { count: parseInt(r.count, 10), total: parseFloat(r.total) || 0 };
    return acc;
  }, {});

  res.json({
    totals: {
      all: { count: parseInt(totals.count, 10), total: parseFloat(totals.total) || 0 },
      today: { count: parseInt(totalToday.count, 10), total: parseFloat(totalToday.total) || 0 },
      month: { count: parseInt(totalMonth.count, 10), total: parseFloat(totalMonth.total) || 0 },
    },
    by_type: formatByType(byType),
    by_type_today: formatByType(byTypeToday),
    by_type_month: formatByType(byTypeMonth),
    top_species: topSpecies.map(s => ({
      species_id: s.species_id,
      species_name: speciesMap[s.species_id] || `ID #${s.species_id}`,
      count: parseInt(s.count, 10),
      total: parseFloat(s.total) || 0,
    })),
    recent,
  });
});

// GET /api/admin/withdrawals/stats — withdrawal statistics
router.get('/withdrawals/stats', async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalCompleted, todayCompleted, monthCompleted,
    totalFees, todayFees, monthFees,
    statusCounts, avgAmount,
  ] = await Promise.all([
    db('withdrawals').where({ status: 'completed' }).sum('net_amount as total').count('id as count').first(),
    db('withdrawals').where({ status: 'completed' }).where('processed_at', '>=', todayStart).sum('net_amount as total').count('id as count').first(),
    db('withdrawals').where({ status: 'completed' }).where('processed_at', '>=', monthStart).sum('net_amount as total').count('id as count').first(),
    db('withdrawals').where({ status: 'completed' }).sum('fee_amount as total').first(),
    db('withdrawals').where({ status: 'completed' }).where('processed_at', '>=', todayStart).sum('fee_amount as total').first(),
    db('withdrawals').where({ status: 'completed' }).where('processed_at', '>=', monthStart).sum('fee_amount as total').first(),
    db('withdrawals').select('status').count('id as count').groupBy('status'),
    db('withdrawals').where({ status: 'completed' }).avg('net_amount as avg').first(),
  ]);

  // Top withdrawers
  const topUsers = await db('withdrawals')
    .where({ status: 'completed' })
    .join('users', 'withdrawals.user_id', 'users.id')
    .select('users.wallet_address')
    .sum('withdrawals.net_amount as total')
    .count('withdrawals.id as count')
    .groupBy('withdrawals.user_id', 'users.wallet_address')
    .orderBy('total', 'desc')
    .limit(10);

  res.json({
    completed: {
      total: { amount: parseFloat(totalCompleted.total) || 0, count: parseInt(totalCompleted.count, 10) },
      today: { amount: parseFloat(todayCompleted.total) || 0, count: parseInt(todayCompleted.count, 10) },
      month: { amount: parseFloat(monthCompleted.total) || 0, count: parseInt(monthCompleted.count, 10) },
    },
    fees: {
      total: parseFloat(totalFees.total) || 0,
      today: parseFloat(todayFees.total) || 0,
      month: parseFloat(monthFees.total) || 0,
    },
    avg_amount: parseFloat(avgAmount.avg) || 0,
    status_counts: statusCounts.reduce((acc, c) => { acc[c.status] = parseInt(c.count, 10); return acc; }, {}),
    top_users: topUsers.map(u => ({
      wallet: u.wallet_address,
      total: parseFloat(u.total) || 0,
      count: parseInt(u.count, 10),
    })),
  });
});

// GET /api/admin/economy — get all economy configs
router.get('/economy', async (req, res) => {
  const configs = await EconomyConfig.getAll();
  res.json(configs);
});

// PUT /api/admin/economy/:key — update a single config
router.put('/economy/:key', async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  if (value === undefined || value === null) {
    return res.status(400).json({ error: 'value required' });
  }

  await EconomyConfig.set(key, value, req.user.id || null);
  res.json({ key, value: String(value), updated: true });
});

// GET /api/admin/economy/history — config change history
router.get('/economy/history', async (req, res) => {
  const history = await db('economy_config_history')
    .leftJoin('users', 'economy_config_history.changed_by', 'users.id')
    .select(
      'economy_config_history.*',
      'users.wallet_address as changed_by_wallet'
    )
    .orderBy('economy_config_history.created_at', 'desc')
    .limit(100);

  res.json(history);
});

// GET /api/admin/withdrawals — withdrawal queue
router.get('/withdrawals', async (req, res) => {
  const status = req.query.status || 'pending';
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const offset = (page - 1) * limit;

  const withdrawals = await db('withdrawals')
    .where({ status })
    .join('users', 'withdrawals.user_id', 'users.id')
    .select(
      'withdrawals.*',
      'users.wallet_address as user_wallet'
    )
    .orderBy('withdrawals.created_at', 'asc')
    .limit(limit)
    .offset(offset);

  const counts = await db('withdrawals')
    .select('status')
    .count('id as count')
    .groupBy('status');

  res.json({ page, limit, withdrawals, counts });
});

// PUT /api/admin/withdrawals/:id/process — approve and mark as processing
router.put('/withdrawals/:id/process', async (req, res) => {
  const { id } = req.params;

  const withdrawal = await db('withdrawals').where({ id, status: 'pending' }).first();
  if (!withdrawal) {
    return res.status(404).json({ error: 'Pending withdrawal not found' });
  }

  await db('withdrawals').where({ id }).update({
    status: 'processing',
    processed_by: req.user.id,
    processed_at: db.fn.now(),
  });

  res.json({
    withdrawal_id: parseInt(id, 10),
    status: 'processing',
    pay_to: withdrawal.wallet_address,
    net_amount: withdrawal.net_amount,
  });
});

// PUT /api/admin/withdrawals/:id/complete — mark as completed with tx hash
router.put('/withdrawals/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { tx_hash } = req.body;

  if (!tx_hash) {
    return res.status(400).json({ error: 'tx_hash required' });
  }

  const withdrawal = await db('withdrawals').where({ id, status: 'processing' }).first();
  if (!withdrawal) {
    return res.status(404).json({ error: 'Processing withdrawal not found' });
  }

  await db('withdrawals').where({ id }).update({
    status: 'completed',
    tx_hash,
    processed_by: req.user.id,
    processed_at: db.fn.now(),
  });

  res.json({ withdrawal_id: parseInt(id, 10), status: 'completed', tx_hash });
});

// PUT /api/admin/withdrawals/:id/reject — reject a withdrawal and refund
router.put('/withdrawals/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  const withdrawal = await db('withdrawals').where({ id }).whereIn('status', ['pending', 'processing']).first();
  if (!withdrawal) {
    return res.status(404).json({ error: 'Active withdrawal not found' });
  }

  await db.transaction(async (trx) => {
    await trx('withdrawals').where({ id }).update({
      status: 'rejected',
      admin_note: note || null,
      processed_by: req.user.id,
      processed_at: trx.fn.now(),
    });

    // Refund the full amount
    const user = await trx('users').where({ id: withdrawal.user_id }).forUpdate().first();
    const newBalance = parseFloat(user.balance_usdt) + parseFloat(withdrawal.amount);
    await trx('users').where({ id: withdrawal.user_id }).update({ balance_usdt: newBalance });
    await trx('wallet_ledger').insert({
      user_id: withdrawal.user_id,
      type: 'admin_adjustment',
      amount: parseFloat(withdrawal.amount),
      balance_after: newBalance,
      reference_id: `withdrawal:${id}`,
      description: `Refund for rejected withdrawal #${id}`,
    });
  });

  res.json({ withdrawal_id: parseInt(id, 10), status: 'rejected' });
});

// GET /api/admin/users — list users with summary
router.get('/users', async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const offset = (page - 1) * limit;

  const users = await db('users')
    .select('id', 'wallet_address', 'role', 'is_banned', 'balance_usdt', 'feed_balance', 'auto_feed_enabled', 'last_login_at', 'created_at')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  const totalRow = await db('users').count('id as count').first();

  res.json({ page, limit, total: parseInt(totalRow.count, 10), users });
});

// PUT /api/admin/users/:id/ban — ban/unban a user
router.put('/users/:id/ban', async (req, res) => {
  const { id } = req.params;
  const { banned } = req.body;

  await db('users').where({ id }).update({ is_banned: !!banned });
  res.json({ user_id: parseInt(id, 10), is_banned: !!banned });
});

// GET /api/admin/deposits — deposit monitoring dashboard
router.get('/deposits', async (req, res) => {
  const status = req.query.status || 'all';
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const offset = (page - 1) * limit;

  const query = db('deposits')
    .leftJoin('users', 'deposits.user_id', 'users.id')
    .select(
      'deposits.*',
      'users.wallet_address as user_wallet'
    )
    .orderBy('deposits.created_at', 'desc')
    .limit(limit)
    .offset(offset);

  if (status !== 'all') {
    query.where('deposits.status', status);
  }

  const deposits = await query;

  const counts = await db('deposits')
    .select('status')
    .count('id as count')
    .groupBy('status');

  const totalVolume = await db('deposits')
    .where({ status: 'confirmed' })
    .sum('amount as total')
    .first();

  res.json({
    page,
    limit,
    deposits,
    counts: counts.reduce((acc, c) => { acc[c.status] = parseInt(c.count, 10); return acc; }, {}),
    total_confirmed_volume: parseFloat(totalVolume.total) || 0,
  });
});

// GET /api/admin/alerts — operational alerts summary
router.get('/alerts', async (req, res) => {
  const starvationHours = await EconomyConfig.getNumber('starvation_death_hours');
  const warningHours = starvationHours - 24; // 48h warning

  const now = new Date();
  const warningThreshold = new Date(now.getTime() - warningHours * 3600000);
  const slaHours = await EconomyConfig.getNumber('withdrawal_sla_hours');
  const slaThreshold = new Date(now.getTime() - slaHours * 3600000);

  const [starvationRisk, pendingWithdrawalsSLA] = await Promise.all([
    db('chickens')
      .where({ status: 'alive' })
      .whereNotNull('starvation_started_at')
      .where('starvation_started_at', '<=', warningThreshold)
      .count('id as count')
      .first(),
    db('withdrawals')
      .where({ status: 'pending' })
      .where('created_at', '<=', slaThreshold)
      .count('id as count')
      .first(),
  ]);

  res.json({
    p1: {
      starvation_risk: parseInt(starvationRisk.count, 10),
      withdrawal_sla_breach: parseInt(pendingWithdrawalsSLA.count, 10),
    },
  });
});

// ── Chicken Species Management ──────────────────

// GET /api/admin/species — list all species
router.get('/species', async (req, res) => {
  const species = await db('chicken_species').select('*').orderBy('id', 'asc');
  res.json(species);
});

// POST /api/admin/species — create a new species
router.post('/species', async (req, res) => {
  const { name, purchase_price, eggs_per_day, feed_per_day, lifespan_days, hatch_probability, species_weight } = req.body;

  if (!name || !purchase_price || !eggs_per_day || !feed_per_day || !lifespan_days) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  const existing = await db('chicken_species').where({ name }).first();
  if (existing) {
    return res.status(409).json({ error: `Espécie "${name}" já existe` });
  }

  const [id] = await db('chicken_species').insert({
    name,
    purchase_price: parseFloat(purchase_price),
    eggs_per_day: parseFloat(eggs_per_day),
    feed_per_day: parseFloat(feed_per_day),
    lifespan_days: parseInt(lifespan_days, 10),
    hatch_probability: parseFloat(hatch_probability || 0),
    species_weight: parseFloat(species_weight || 0),
  });

  const created = await db('chicken_species').where({ id }).first();
  res.json(created);
});

// PUT /api/admin/species/:id — update a species
router.put('/species/:id', async (req, res) => {
  const { id } = req.params;
  const { name, purchase_price, eggs_per_day, feed_per_day, lifespan_days, hatch_probability, species_weight, is_active } = req.body;

  const species = await db('chicken_species').where({ id }).first();
  if (!species) {
    return res.status(404).json({ error: 'Espécie não encontrada' });
  }

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (purchase_price !== undefined) updates.purchase_price = parseFloat(purchase_price);
  if (eggs_per_day !== undefined) updates.eggs_per_day = parseFloat(eggs_per_day);
  if (feed_per_day !== undefined) updates.feed_per_day = parseFloat(feed_per_day);
  if (lifespan_days !== undefined) updates.lifespan_days = parseInt(lifespan_days, 10);
  if (hatch_probability !== undefined) updates.hatch_probability = parseFloat(hatch_probability);
  if (species_weight !== undefined) updates.species_weight = parseFloat(species_weight);
  if (is_active !== undefined) updates.is_active = !!is_active;

  await db('chicken_species').where({ id }).update(updates);
  const updated = await db('chicken_species').where({ id }).first();
  res.json(updated);
});

// DELETE /api/admin/species/:id — deactivate a species
router.delete('/species/:id', async (req, res) => {
  const { id } = req.params;

  const activeChickens = await db('chickens')
    .where({ species_id: id, status: 'alive' })
    .count('id as count')
    .first();

  if (parseInt(activeChickens.count, 10) > 0) {
    // Don't delete, just deactivate
    await db('chicken_species').where({ id }).update({ is_active: false });
    return res.json({ id: parseInt(id, 10), deactivated: true, reason: 'Existem galinhas vivas desta espécie' });
  }

  await db('chicken_species').where({ id }).update({ is_active: false });
  res.json({ id: parseInt(id, 10), deactivated: true });
});

module.exports = router;
