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

  const [user, chickens, eggCount, chicks, chickFeedNeeded, incubationHours, chickGrowthDays] = await Promise.all([
    db('users').where({ id: userId }).first('balance_usdt', 'feed_balance', 'auto_feed_enabled'),
    db('chickens')
      .where({ user_id: userId, status: 'alive' })
      .join('chicken_species', 'chickens.species_id', 'chicken_species.id')
      .select(
        'chickens.id',
        'chickens.name',
        'chicken_species.name as species',
        'chickens.born_at',
        'chickens.dies_at',
        'chickens.starvation_started_at',
        'chickens.total_feed_consumed',
        'chickens.total_eggs_produced'
      ),
    db('eggs').where({ user_id: userId, status: 'available' }).count('id as count').first(),
    db('chicks')
      .where({ user_id: userId, status: 'growing' })
      .join('chicken_species', 'chicks.target_species_id', 'chicken_species.id')
      .select('chicks.id', 'chicken_species.name as target_species', 'chicks.hatched_at', 'chicks.feed_consumed'),
    EconomyConfig.getNumber('chick_to_adult_feed'),
    EconomyConfig.getNumber('egg_incubation_hours'),
    EconomyConfig.getNumber('chick_growth_days'),
  ]);

  // Get incubating eggs
  const incubatingEggs = await db('eggs')
    .where({ user_id: userId, status: 'incubating' })
    .select('id', 'incubation_started_at')
    .orderBy('incubation_started_at', 'asc');

  // Get recently hatched/failed eggs (last 50)
  const hatchedEggs = await db('eggs')
    .where({ user_id: userId })
    .whereIn('status', ['hatched', 'failed'])
    .select('id', 'status', 'incubation_started_at', 'hatched_at')
    .orderBy('hatched_at', 'desc')
    .limit(50);

  res.json({
    balance_usdt: parseFloat(user.balance_usdt),
    feed_balance: parseFloat(user.feed_balance),
    auto_feed_enabled: user.auto_feed_enabled,
    chickens,
    eggs_available: parseInt(eggCount.count, 10),
    chicks,
    chick_feed_needed: chickFeedNeeded,
    incubating_eggs: incubatingEggs,
    hatched_eggs: hatchedEggs,
    incubation_hours: incubationHours,
    chick_growth_days: chickGrowthDays,
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

// GET /api/client/feed-price — get current feed unit price
router.get('/feed-price', async (req, res) => {
  const feedPrice = await EconomyConfig.getNumber('feed_unit_price');
  res.json({ feed_unit_price: feedPrice });
});

// GET /api/client/egg-price — get current egg purchase price
router.get('/egg-price', async (req, res) => {
  const eggPrice = await EconomyConfig.getNumber('egg_purchase_price');
  res.json({ egg_purchase_price: eggPrice });
});

// POST /api/client/buy-eggs — submit tx_hash after MetaMask payment for eggs
router.post('/buy-eggs', async (req, res) => {
  const userId = req.user.id;
  const { quantity, tx_hash } = req.body;

  const qty = parseInt(quantity, 10);
  if (!qty || qty <= 0) {
    return res.status(400).json({ error: 'Valid quantity required' });
  }
  if (!tx_hash || typeof tx_hash !== 'string' || !tx_hash.startsWith('0x')) {
    return res.status(400).json({ error: 'Valid tx_hash required' });
  }

  const eggPrice = await EconomyConfig.getNumber('egg_purchase_price');
  if (!eggPrice || eggPrice <= 0) {
    return res.status(500).json({ error: 'Egg price not configured' });
  }
  const cost = parseFloat((qty * eggPrice).toFixed(2));

  const user = await db('users').where({ id: userId }).first('wallet_address');

  try {
    await db('pending_purchases').insert({
      user_id: userId,
      tx_hash,
      purchase_type: 'eggs',
      purchase_data: JSON.stringify({ quantity: qty }),
      expected_amount: cost,
      from_address: user.wallet_address,
      status: 'pending',
    });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'ER_DUP_ENTRY' || err.errno === 19) {
      return res.status(409).json({ error: 'Transaction already submitted' });
    }
    throw err;
  }

  res.json({ status: 'pending', tx_hash, cost, quantity: qty, message: 'Eggs will be credited after blockchain verification.' });
});

// POST /api/client/buy-feed — submit tx_hash after MetaMask payment
router.post('/buy-feed', async (req, res) => {
  const userId = req.user.id;
  const { quantity, tx_hash } = req.body;

  if (!quantity || quantity <= 0 || !Number.isFinite(quantity)) {
    return res.status(400).json({ error: 'Valid quantity required' });
  }
  if (!tx_hash || typeof tx_hash !== 'string' || !tx_hash.startsWith('0x')) {
    return res.status(400).json({ error: 'Valid tx_hash required' });
  }

  const feedPrice = await EconomyConfig.getNumber('feed_unit_price');
  if (!feedPrice || feedPrice <= 0) {
    return res.status(500).json({ error: 'Feed price not configured' });
  }
  const cost = parseFloat((quantity * feedPrice).toFixed(2));

  const user = await db('users').where({ id: userId }).first('wallet_address');

  try {
    await db('pending_purchases').insert({
      user_id: userId,
      tx_hash,
      purchase_type: 'feed',
      purchase_data: JSON.stringify({ quantity }),
      expected_amount: cost,
      from_address: user.wallet_address,
      status: 'pending',
    });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'ER_DUP_ENTRY' || err.errno === 19) {
      return res.status(409).json({ error: 'Transaction already submitted' });
    }
    throw err;
  }

  res.json({ status: 'pending', tx_hash, cost, message: 'Purchase will be confirmed after blockchain verification.' });
});

// POST /api/client/toggle-auto-feed
router.post('/toggle-auto-feed', async (req, res) => {
  const userId = req.user.id;
  const user = await db('users').where({ id: userId }).first('auto_feed_enabled');
  const newState = !user.auto_feed_enabled;
  await db('users').where({ id: userId }).update({ auto_feed_enabled: newState });
  res.json({ auto_feed_enabled: newState });
});

// POST /api/client/buy-chicken — submit tx_hash after MetaMask payment
router.post('/buy-chicken', async (req, res) => {
  const userId = req.user.id;
  const { species_id, tx_hash } = req.body;

  if (!species_id) {
    return res.status(400).json({ error: 'species_id required' });
  }
  if (!tx_hash || typeof tx_hash !== 'string' || !tx_hash.startsWith('0x')) {
    return res.status(400).json({ error: 'Valid tx_hash required' });
  }

  const species = await db('chicken_species').where({ id: species_id, is_active: true }).first();
  if (!species) {
    return res.status(404).json({ error: 'Species not found or inactive' });
  }

  const user = await db('users').where({ id: userId }).first('wallet_address');

  try {
    await db('pending_purchases').insert({
      user_id: userId,
      tx_hash,
      purchase_type: 'chicken',
      purchase_data: JSON.stringify({ species_id: species.id }),
      expected_amount: parseFloat(species.purchase_price),
      from_address: user.wallet_address,
      status: 'pending',
    });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'ER_DUP_ENTRY' || err.errno === 19) {
      return res.status(409).json({ error: 'Transaction already submitted' });
    }
    throw err;
  }

  res.json({ status: 'pending', tx_hash, cost: parseFloat(species.purchase_price), species: species.name, message: 'Chicken will be added after blockchain verification.' });
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

  let feeRate = await EconomyConfig.getNumber('withdrawal_fee_rate');
  // Treat values >= 1 as percentage (e.g. 5 = 5%), convert to decimal
  if (feeRate >= 1) feeRate = feeRate / 100;
  const feeAmount = parseFloat((amount * feeRate).toFixed(2));
  const netAmount = parseFloat((amount - feeAmount).toFixed(2));

  if (netAmount <= 0) {
    return res.status(400).json({ error: `Withdrawal amount too small to cover the fee (${(feeRate * 100).toFixed(1)}%)` });
  }

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

// POST /api/client/incubate-egg — start incubating an egg
router.post('/incubate-egg', async (req, res) => {
  try {
  const userId = req.user.id;
  const { egg_id } = req.body;

  if (!egg_id) {
    return res.status(400).json({ error: 'egg_id required' });
  }

  const eggFeedCost = await EconomyConfig.getNumber('egg_to_chick_feed');
  if (!eggFeedCost || eggFeedCost <= 0) {
    return res.status(500).json({ error: 'Incubation feed cost not configured' });
  }

  const result = await db.transaction(async (trx) => {
    const egg = await trx('eggs')
      .where({ id: egg_id, user_id: userId, status: 'available' })
      .forUpdate()
      .first();

    if (!egg) {
      throw new Error('Egg not found or not available');
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
  } catch (err) {
    console.error('[CLIENT] POST /incubate-egg error:', err.message);
    const msg = err.message === 'Insufficient feed' ? 'Insufficient feed for incubation'
      : err.message === 'Egg not found or not available' ? err.message
      : 'Failed to incubate egg';
    res.status(400).json({ error: msg });
  }
});

// POST /api/client/incubate-all-eggs — incubate all available eggs at once
router.post('/incubate-all-eggs', async (req, res) => {
  try {
    const userId = req.user.id;

    const eggFeedCost = await EconomyConfig.getNumber('egg_to_chick_feed');
    if (!eggFeedCost || eggFeedCost <= 0) {
      return res.status(500).json({ error: 'Incubation feed cost not configured' });
    }

    const result = await db.transaction(async (trx) => {
      const eggs = await trx('eggs')
        .where({ user_id: userId, status: 'available' })
        .forUpdate()
        .select('id');

      if (eggs.length === 0) {
        throw new Error('No eggs available to incubate');
      }

      const user = await trx('users').where({ id: userId }).forUpdate().first();
      const currentFeed = parseFloat(user.feed_balance);
      const totalCost = eggFeedCost * eggs.length;
      const maxAffordable = Math.floor(currentFeed / eggFeedCost);

      if (maxAffordable <= 0) {
        throw new Error('Insufficient feed');
      }

      const eggsToIncubate = eggs.slice(0, maxAffordable);
      const eggIds = eggsToIncubate.map(e => e.id);
      const actualCost = parseFloat((eggFeedCost * eggIds.length).toFixed(2));

      await adjustFeed(trx, userId, -actualCost);

      await trx('eggs').whereIn('id', eggIds).update({
        status: 'incubating',
        incubation_started_at: trx.fn.now(),
      });

      return {
        incubated: eggIds.length,
        total_available: eggs.length,
        feed_consumed: actualCost,
        egg_ids: eggIds,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('[CLIENT] POST /incubate-all-eggs error:', err.message);
    const msg = err.message === 'Insufficient feed' ? 'Insufficient feed for incubation'
      : err.message === 'No eggs available to incubate' ? err.message
      : 'Failed to incubate eggs';
    res.status(400).json({ error: msg });
  }
});

// GET /api/client/eggs-for-incubation — list eggs available for incubation
router.get('/eggs-for-incubation', async (req, res) => {
  const userId = req.user.id;

  const eggs = await db('eggs')
    .where({ user_id: userId, status: 'available' })
    .select('id', 'chicken_id', 'produced_at')
    .orderBy('produced_at', 'desc');

  const incubating = await db('eggs')
    .where({ user_id: userId, status: 'incubating' })
    .select('id', 'incubation_started_at')
    .orderBy('incubation_started_at', 'desc');

  res.json({ eggs, incubating });
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

// POST /api/client/feed-all-chicks — feed all growing chicks to max
router.post('/feed-all-chicks', async (req, res) => {
  try {
    const userId = req.user.id;

    const chickFeedNeeded = await EconomyConfig.getNumber('chick_to_adult_feed');

    const result = await db.transaction(async (trx) => {
      const chicks = await trx('chicks')
        .where({ user_id: userId, status: 'growing' })
        .forUpdate()
        .select('id', 'feed_consumed');

      if (chicks.length === 0) {
        throw new Error('No growing chicks to feed');
      }

      const user = await trx('users').where({ id: userId }).forUpdate().first();
      let remainingFeed = parseFloat(user.feed_balance);
      let totalFed = 0;
      const fedChicks = [];

      for (const chick of chicks) {
        const currentFeed = parseFloat(chick.feed_consumed);
        const remaining = Math.max(0, chickFeedNeeded - currentFeed);
        if (remaining <= 0) continue;

        const actualFeed = Math.min(remaining, remainingFeed);
        if (actualFeed <= 0) break;

        const newChickFeed = parseFloat((currentFeed + actualFeed).toFixed(2));
        await trx('chicks').where({ id: chick.id }).update({ feed_consumed: newChickFeed });

        remainingFeed = parseFloat((remainingFeed - actualFeed).toFixed(2));
        totalFed = parseFloat((totalFed + actualFeed).toFixed(2));
        fedChicks.push({ chick_id: chick.id, fed: actualFeed, total_fed: newChickFeed });
      }

      if (totalFed <= 0) {
        throw new Error('All chicks already fully fed or insufficient feed');
      }

      await adjustFeed(trx, userId, -totalFed);

      return {
        chicks_fed: fedChicks.length,
        total_feed_used: totalFed,
        details: fedChicks,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('[CLIENT] POST /feed-all-chicks error:', err.message);
    const msg = err.message === 'No growing chicks to feed' ? err.message
      : err.message === 'All chicks already fully fed or insufficient feed' ? err.message
      : 'Failed to feed chicks';
    res.status(400).json({ error: msg });
  }
});

// PATCH /api/client/chicken/:id/name — rename a chicken
router.patch('/chicken/:id/name', async (req, res) => {
  const userId = req.user.id;
  const chickenId = parseInt(req.params.id, 10);
  const { name } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Name is required' });
  }

  const trimmed = name.trim().slice(0, 30);
  if (trimmed.length === 0) {
    return res.status(400).json({ error: 'Name cannot be empty' });
  }

  const chicken = await db('chickens').where({ id: chickenId, user_id: userId }).first();
  if (!chicken) {
    return res.status(404).json({ error: 'Chicken not found' });
  }

  await db('chickens').where({ id: chickenId }).update({ name: trimmed });
  res.json({ id: chickenId, name: trimmed });
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
      'chickens.name',
      'chicken_species.name as species',
      'chickens.born_at',
      'chickens.died_at',
      'chickens.death_cause',
      'chickens.total_feed_consumed',
      'chickens.total_eggs_produced'
    )
    .orderBy('chickens.died_at', 'desc')
    .limit(limit)
    .offset(offset);

  res.json({ page, limit, chickens });
});

// GET /api/client/purchases — pending/confirmed purchase history
router.get('/purchases', async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
  const offset = (page - 1) * limit;

  const purchases = await db('pending_purchases')
    .where({ user_id: userId })
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset);

  res.json({ page, limit, purchases });
});

// GET /api/client/egg-history — history of hatched/failed eggs with pagination
router.get('/egg-history', async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
  const offset = (page - 1) * limit;

  const eggs = await db('eggs')
    .where({ user_id: userId })
    .whereIn('status', ['hatched', 'failed'])
    .select('id', 'status', 'incubation_started_at', 'hatched_at')
    .orderBy('hatched_at', 'desc')
    .limit(limit)
    .offset(offset);

  const totalRow = await db('eggs')
    .where({ user_id: userId })
    .whereIn('status', ['hatched', 'failed'])
    .count('id as count')
    .first();

  res.json({ page, limit, total: parseInt(totalRow.count, 10), eggs });
});

// GET /api/client/chick-history — history of promoted chicks with pagination
router.get('/chick-history', async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
  const offset = (page - 1) * limit;

  const chicks = await db('chicks')
    .where({ 'chicks.user_id': userId, 'chicks.status': 'adult' })
    .join('chicken_species', 'chicks.target_species_id', 'chicken_species.id')
    .select('chicks.id', 'chicken_species.name as species', 'chicks.hatched_at', 'chicks.adult_at', 'chicks.feed_consumed')
    .orderBy('chicks.adult_at', 'desc')
    .limit(limit)
    .offset(offset);

  const totalRow = await db('chicks')
    .where({ user_id: userId, status: 'adult' })
    .count('id as count')
    .first();

  res.json({ page, limit, total: parseInt(totalRow.count, 10), chicks });
});

module.exports = router;
