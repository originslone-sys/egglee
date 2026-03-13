const { Router } = require('express');
const db = require('../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const EconomyConfig = require('../models/EconomyConfig');

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

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
