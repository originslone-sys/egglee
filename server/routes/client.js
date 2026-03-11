const { Router } = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { adjustBalance, adjustFeed } = require('../utils/wallet');
const EconomyConfig = require('../models/EconomyConfig');

const router = Router();
router.use(authenticate);

// GET /api/client/farm — full farm status
router.get('/farm', async (req, res) => {
  const userId = req.user.id;

  const [user, chickens, eggCount, chicks] = await Promise.all([
    db('users').where({ id: userId }).first('balance_usdt', 'feed_balance', 'auto_feed_enabled'),
    db('chickens')
      .where({ user_id: userId, status: 'alive' })
      .join('chicken_species', 'chickens.species_id', 'chicken_species.id')
      .select(
        'chickens.id',
        'chicken_species.name as species',
        'chickens.born_at',
        'chickens.dies_at',
        'chickens.starvation_started_at'
      ),
    db('eggs').where({ user_id: userId, status: 'available' }).count('id as count').first(),
    db('chicks')
      .where({ user_id: userId, status: 'growing' })
      .join('chicken_species', 'chicks.target_species_id', 'chicken_species.id')
      .select('chicks.id', 'chicken_species.name as target_species', 'chicks.hatched_at', 'chicks.feed_consumed'),
  ]);

  res.json({
    balance_usdt: parseFloat(user.balance_usdt),
    feed_balance: parseFloat(user.feed_balance),
    auto_feed_enabled: user.auto_feed_enabled,
    chickens,
    eggs_available: parseInt(eggCount.count, 10),
    chicks,
  });
});

// POST /api/client/collect-eggs — collect all available eggs and sell to system
router.post('/collect-eggs', async (req, res) => {
  const userId = req.user.id;

  const result = await db.transaction(async (trx) => {
    const eggs = await trx('eggs')
      .where({ user_id: userId, status: 'available' })
      .select('id');

    if (eggs.length === 0) {
      return { collected: 0, earned: 0 };
    }

    const eggPrice = await EconomyConfig.getNumber('egg_system_price');
    const earned = parseFloat((eggs.length * eggPrice).toFixed(2));

    await trx('eggs')
      .whereIn('id', eggs.map((e) => e.id))
      .update({ status: 'sold_system', collected_at: trx.fn.now() });

    const newBalance = await adjustBalance(
      trx, userId, earned, 'egg_sale_system',
      `Sold ${eggs.length} eggs at ${eggPrice} USDT each`,
      `eggs:${eggs.length}`
    );

    return { collected: eggs.length, earned, new_balance: newBalance };
  });

  res.json(result);
});

// POST /api/client/buy-feed — buy feed with USDT
router.post('/buy-feed', async (req, res) => {
  const userId = req.user.id;
  const { quantity } = req.body;

  if (!quantity || quantity <= 0 || !Number.isFinite(quantity)) {
    return res.status(400).json({ error: 'Valid quantity required' });
  }

  const feedPrice = await EconomyConfig.getNumber('feed_unit_price');
  if (!feedPrice || feedPrice <= 0) {
    return res.status(500).json({ error: 'Feed price not configured' });
  }
  const cost = parseFloat((quantity * feedPrice).toFixed(2));
  if (cost <= 0) {
    return res.status(400).json({ error: 'Invalid purchase amount' });
  }

  const result = await db.transaction(async (trx) => {
    const newBalance = await adjustBalance(
      trx, userId, -cost, 'feed_purchase',
      `Bought ${quantity} feed units at ${feedPrice} USDT each`
    );
    const newFeed = await adjustFeed(trx, userId, quantity);

    return { cost, new_balance: newBalance, new_feed: newFeed };
  });

  res.json(result);
});

// POST /api/client/toggle-auto-feed
router.post('/toggle-auto-feed', async (req, res) => {
  const userId = req.user.id;
  const user = await db('users').where({ id: userId }).first('auto_feed_enabled');
  const newState = !user.auto_feed_enabled;
  await db('users').where({ id: userId }).update({ auto_feed_enabled: newState });
  res.json({ auto_feed_enabled: newState });
});

// POST /api/client/buy-chicken — buy a chicken by species
router.post('/buy-chicken', async (req, res) => {
  const userId = req.user.id;
  const { species_id } = req.body;

  if (!species_id) {
    return res.status(400).json({ error: 'species_id required' });
  }

  const species = await db('chicken_species').where({ id: species_id, is_active: true }).first();
  if (!species) {
    return res.status(404).json({ error: 'Species not found or inactive' });
  }

  const result = await db.transaction(async (trx) => {
    const newBalance = await adjustBalance(
      trx, userId, -species.purchase_price, 'chicken_purchase',
      `Bought 1 ${species.name} chicken`
    );

    const now = new Date();
    const diesAt = new Date(now.getTime() + species.lifespan_days * 86400000);
    const [chickenId] = await trx('chickens').insert({
      user_id: userId,
      species_id: species.id,
      born_at: now,
      dies_at: diesAt,
    });

    return { chicken_id: chickenId, species: species.name, new_balance: newBalance };
  });

  res.json(result);
});

// POST /api/client/withdraw — request USDT withdrawal
router.post('/withdraw', async (req, res) => {
  const userId = req.user.id;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid amount required' });
  }

  const minAmount = await EconomyConfig.getNumber('withdrawal_min_amount');
  if (amount < minAmount) {
    return res.status(400).json({ error: `Minimum withdrawal: ${minAmount} USDT` });
  }

  const maxPerDay = await EconomyConfig.getNumber('max_withdrawals_per_day');
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayCount = await db('withdrawals')
    .where({ user_id: userId })
    .where('created_at', '>=', todayStart)
    .count('id as count')
    .first();

  if (parseInt(todayCount.count, 10) >= maxPerDay) {
    return res.status(429).json({ error: `Max ${maxPerDay} withdrawal(s) per day` });
  }

  const feeRate = await EconomyConfig.getNumber('withdrawal_fee_rate');
  const feeAmount = parseFloat((amount * feeRate).toFixed(2));
  const netAmount = parseFloat((amount - feeAmount).toFixed(2));

  const user = await db('users').where({ id: userId }).first('wallet_address');

  const result = await db.transaction(async (trx) => {
    await adjustBalance(trx, userId, -amount, 'withdrawal', `Withdrawal request: ${amount} USDT (fee: ${feeAmount})`);

    const [withdrawalId] = await trx('withdrawals').insert({
      user_id: userId,
      amount,
      fee_amount: feeAmount,
      net_amount: netAmount,
      wallet_address: user.wallet_address,
    });

    return { withdrawal_id: withdrawalId, amount, fee: feeAmount, net: netAmount, status: 'pending' };
  });

  res.json(result);
});

// GET /api/client/species — list available chicken species
router.get('/species', async (req, res) => {
  const species = await db('chicken_species').where({ is_active: true }).select('*');
  res.json(species);
});

// GET /api/client/ledger — wallet transaction history
router.get('/ledger', async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
  const offset = (page - 1) * limit;

  const entries = await db('wallet_ledger')
    .where({ user_id: userId })
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  res.json({ page, limit, entries });
});

// POST /api/client/incubate-egg — start incubating a fertile egg
router.post('/incubate-egg', async (req, res) => {
  const userId = req.user.id;
  const { egg_id } = req.body;

  if (!egg_id) {
    return res.status(400).json({ error: 'egg_id required' });
  }

  const eggFeedCost = await EconomyConfig.getNumber('egg_to_chick_feed');

  const result = await db.transaction(async (trx) => {
    const egg = await trx('eggs')
      .where({ id: egg_id, user_id: userId, status: 'available', is_fertile: true })
      .forUpdate()
      .first();

    if (!egg) {
      throw new Error('Fertile egg not found or not available');
    }

    // Consume feed for incubation
    const newFeed = await adjustFeed(trx, userId, -eggFeedCost);

    await trx('eggs').where({ id: egg_id }).update({
      status: 'incubating',
      incubation_started_at: trx.fn.now(),
    });

    return { egg_id, status: 'incubating', feed_consumed: eggFeedCost, new_feed: newFeed };
  });

  res.json(result);
});

// GET /api/client/fertile-eggs — list fertile eggs available for incubation
router.get('/fertile-eggs', async (req, res) => {
  const userId = req.user.id;

  const eggs = await db('eggs')
    .where({ user_id: userId, status: 'available', is_fertile: true })
    .select('id', 'chicken_id', 'produced_at')
    .orderBy('produced_at', 'desc');

  const incubating = await db('eggs')
    .where({ user_id: userId, status: 'incubating' })
    .select('id', 'incubation_started_at')
    .orderBy('incubation_started_at', 'desc');

  res.json({ fertile: eggs, incubating });
});

// POST /api/client/feed-chick — feed a growing chick
router.post('/feed-chick', async (req, res) => {
  const userId = req.user.id;
  const { chick_id, amount } = req.body;

  if (!chick_id) {
    return res.status(400).json({ error: 'chick_id required' });
  }

  const feedAmount = Math.max(0.1, Math.min(parseFloat(amount || '0.5'), 5.0));

  const result = await db.transaction(async (trx) => {
    const chick = await trx('chicks')
      .where({ id: chick_id, user_id: userId, status: 'growing' })
      .forUpdate()
      .first();

    if (!chick) {
      throw new Error('Growing chick not found');
    }

    const chickFeedNeeded = await EconomyConfig.getNumber('chick_to_adult_feed');
    const currentFeed = parseFloat(chick.feed_consumed);
    const remaining = Math.max(0, chickFeedNeeded - currentFeed);
    const actualFeed = Math.min(feedAmount, remaining);

    if (actualFeed <= 0) {
      throw new Error('Chick is already fully fed');
    }

    // Consume user feed
    const newFeed = await adjustFeed(trx, userId, -actualFeed);

    const newChickFeed = parseFloat((currentFeed + actualFeed).toFixed(2));
    await trx('chicks').where({ id: chick_id }).update({ feed_consumed: newChickFeed });

    return {
      chick_id,
      fed: actualFeed,
      total_fed: newChickFeed,
      needed: chickFeedNeeded,
      progress: Math.min(100, ((newChickFeed / chickFeedNeeded) * 100)).toFixed(0) + '%',
      new_feed: newFeed,
    };
  });

  res.json(result);
});

// GET /api/client/dead-chickens — deceased chickens history
router.get('/dead-chickens', async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
  const offset = (page - 1) * limit;

  const chickens = await db('chickens')
    .where({ user_id: userId, status: 'dead' })
    .join('chicken_species', 'chickens.species_id', 'chicken_species.id')
    .select(
      'chickens.id',
      'chicken_species.name as species',
      'chickens.born_at',
      'chickens.died_at',
      'chickens.death_cause'
    )
    .orderBy('chickens.died_at', 'desc')
    .limit(limit)
    .offset(offset);

  res.json({ page, limit, chickens });
});

// POST /api/client/notify-deposit — client notifies about a sent transaction (optional, monitor will pick it up anyway)
router.post('/notify-deposit', async (req, res) => {
  const { tx_hash, amount } = req.body;
  if (!tx_hash || !amount) {
    return res.status(400).json({ error: 'tx_hash and amount are required' });
  }
  const existing = await db('deposits').where({ tx_hash }).first();
  if (existing) {
    return res.json({ status: 'already_tracked', deposit_id: existing.id });
  }
  const user = await db('users').where({ id: req.user.id }).first('wallet_address');
  await db('deposits').insert({
    user_id: req.user.id,
    tx_hash,
    from_address: user.wallet_address,
    to_address: '0x8417C9a00249Da8e4ff7414c5992C08511c28328'.toLowerCase(),
    amount: parseFloat(amount).toFixed(2),
    block_number: 0,
    confirmations: 0,
    status: 'pending',
  }).onConflict('tx_hash').ignore();
  res.json({ status: 'pending', message: 'Deposit tracked. Balance will be credited after confirmation.' });
});

// GET /api/client/deposits — deposit history
router.get('/deposits', async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
  const offset = (page - 1) * limit;

  const deposits = await db('deposits')
    .where({ user_id: userId })
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  res.json({ page, limit, deposits });
});

module.exports = router;
