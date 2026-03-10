const { Router } = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { adjustBalance } = require('../utils/wallet');
const EconomyConfig = require('../models/EconomyConfig');

const router = Router();
router.use(authenticate);

// ── Fee calculation helper ───────────────────────

async function getUserP2PFeeRate(userId) {
  const tiers = await EconomyConfig.getJSON('p2p_fee_tiers');
  if (!tiers || tiers.length === 0) return 0.08;

  // Calculate user's 30-day P2P sell volume
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const volumeRow = await db('marketplace_orders')
    .where({ seller_id: userId, status: 'sold' })
    .where('sold_at', '>=', thirtyDaysAgo)
    .sum('price as total')
    .first();

  const volume = parseFloat(volumeRow.total) || 0;

  for (const tier of tiers) {
    if (tier.max_volume === null || volume < tier.max_volume) {
      return tier.rate;
    }
  }
  return tiers[tiers.length - 1].rate;
}

// GET /api/marketplace/listings — browse active listings
router.get('/listings', async (req, res) => {
  const itemType = req.query.type || 'egg';
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
  const offset = (page - 1) * limit;
  const sort = req.query.sort === 'price_desc' ? 'desc' : 'asc';

  const query = db('marketplace_orders')
    .where({ status: 'listed', item_type: itemType })
    .where('seller_id', '!=', req.user.id)
    .join('users', 'marketplace_orders.seller_id', 'users.id')
    .select(
      'marketplace_orders.id',
      'marketplace_orders.item_type',
      'marketplace_orders.item_id',
      'marketplace_orders.price',
      'marketplace_orders.created_at',
      'users.wallet_address as seller_wallet'
    )
    .orderBy('marketplace_orders.price', sort)
    .limit(limit)
    .offset(offset);

  // If listing chickens, join species name
  if (itemType === 'chicken') {
    query
      .leftJoin('chickens', 'marketplace_orders.item_id', 'chickens.id')
      .leftJoin('chicken_species', 'chickens.species_id', 'chicken_species.id')
      .select('chicken_species.name as species_name');
  }

  const listings = await query;

  const countRow = await db('marketplace_orders')
    .where({ status: 'listed', item_type: itemType })
    .where('seller_id', '!=', req.user.id)
    .count('id as total')
    .first();

  res.json({
    page,
    limit,
    total: parseInt(countRow.total, 10),
    listings,
  });
});

// GET /api/marketplace/my-orders — my listings & purchase history
router.get('/my-orders', async (req, res) => {
  const userId = req.user.id;
  const status = req.query.status; // optional filter

  const sellingQuery = db('marketplace_orders').where({ seller_id: userId });
  const boughtQuery = db('marketplace_orders').where({ buyer_id: userId, status: 'sold' });

  if (status) {
    sellingQuery.where({ status });
  }

  const [selling, bought] = await Promise.all([
    sellingQuery.orderBy('created_at', 'desc').limit(50),
    boughtQuery.orderBy('sold_at', 'desc').limit(50),
  ]);

  res.json({ selling, bought });
});

// GET /api/marketplace/my-fee — current user fee rate
router.get('/my-fee', async (req, res) => {
  const rate = await getUserP2PFeeRate(req.user.id);
  res.json({ fee_rate: rate, fee_percent: (rate * 100).toFixed(1) + '%' });
});

// POST /api/marketplace/list-egg — list eggs for sale
router.post('/list-egg', async (req, res) => {
  const userId = req.user.id;
  const { price, quantity } = req.body;

  if (!price || price <= 0) {
    return res.status(400).json({ error: 'Valid price required' });
  }
  const qty = Math.max(1, parseInt(quantity || '1', 10));

  const feeRate = await getUserP2PFeeRate(userId);

  const result = await db.transaction(async (trx) => {
    // Get available (uncollected) eggs
    const eggs = await trx('eggs')
      .where({ user_id: userId, status: 'available' })
      .limit(qty)
      .select('id')
      .forUpdate();

    if (eggs.length === 0) {
      throw new Error('No available eggs to list');
    }
    if (eggs.length < qty) {
      throw new Error(`Only ${eggs.length} eggs available, requested ${qty}`);
    }

    const orders = [];
    for (const egg of eggs) {
      // Mark egg as being in P2P listing
      await trx('eggs').where({ id: egg.id }).update({ status: 'collected', collected_at: trx.fn.now() });

      const [orderId] = await trx('marketplace_orders').insert({
        seller_id: userId,
        item_type: 'egg',
        item_id: egg.id,
        price: parseFloat(price),
        fee_rate: feeRate,
      });
      orders.push(orderId);
    }

    return { listed: orders.length, order_ids: orders, fee_rate: feeRate };
  });

  res.json(result);
});

// POST /api/marketplace/list-chicken — list a chicken for sale
router.post('/list-chicken', async (req, res) => {
  const userId = req.user.id;
  const { chicken_id, price } = req.body;

  if (!chicken_id || !price || price <= 0) {
    return res.status(400).json({ error: 'chicken_id and valid price required' });
  }

  const feeRate = await getUserP2PFeeRate(userId);

  const result = await db.transaction(async (trx) => {
    const chicken = await trx('chickens')
      .where({ id: chicken_id, user_id: userId, status: 'alive' })
      .forUpdate()
      .first();

    if (!chicken) {
      throw new Error('Chicken not found or not available');
    }

    // Check not already listed
    const existing = await trx('marketplace_orders')
      .where({ item_type: 'chicken', item_id: chicken_id, status: 'listed' })
      .first();
    if (existing) {
      throw new Error('This chicken is already listed');
    }

    const [orderId] = await trx('marketplace_orders').insert({
      seller_id: userId,
      item_type: 'chicken',
      item_id: chicken_id,
      price: parseFloat(price),
      fee_rate: feeRate,
    });

    return { order_id: orderId, fee_rate: feeRate };
  });

  res.json(result);
});

// POST /api/marketplace/buy/:id — buy a listed item
router.post('/buy/:id', async (req, res) => {
  const buyerId = req.user.id;
  const orderId = parseInt(req.params.id, 10);

  const result = await db.transaction(async (trx) => {
    const order = await trx('marketplace_orders')
      .where({ id: orderId, status: 'listed' })
      .forUpdate()
      .first();

    if (!order) {
      throw new Error('Listing not found or already sold');
    }

    if (order.seller_id === buyerId) {
      throw new Error('Cannot buy your own listing');
    }

    const price = parseFloat(order.price);
    const feeAmount = parseFloat((price * parseFloat(order.fee_rate)).toFixed(2));
    const sellerReceives = parseFloat((price - feeAmount).toFixed(2));

    // Debit buyer
    await adjustBalance(
      trx, buyerId, -price, 'egg_purchase_p2p',
      `P2P purchase: order #${orderId}`,
      `p2p:${orderId}`
    );

    // Credit seller (minus fee)
    await adjustBalance(
      trx, order.seller_id, sellerReceives,
      order.item_type === 'egg' ? 'egg_sale_p2p' : 'egg_sale_p2p',
      `P2P sale: order #${orderId} (fee ${(parseFloat(order.fee_rate) * 100).toFixed(1)}%)`,
      `p2p:${orderId}`
    );

    // Transfer item ownership
    if (order.item_type === 'egg') {
      await trx('eggs').where({ id: order.item_id }).update({
        user_id: buyerId,
        status: 'available',
        collected_at: null,
      });
    } else if (order.item_type === 'chicken') {
      await trx('chickens').where({ id: order.item_id }).update({
        user_id: buyerId,
      });
    }

    // Update order
    await trx('marketplace_orders').where({ id: orderId }).update({
      buyer_id: buyerId,
      status: 'sold',
      fee_amount: feeAmount,
      sold_at: trx.fn.now(),
    });

    return {
      order_id: orderId,
      item_type: order.item_type,
      price,
      fee: feeAmount,
      seller_received: sellerReceives,
    };
  });

  res.json(result);
});

// POST /api/marketplace/cancel/:id — cancel own listing
router.post('/cancel/:id', async (req, res) => {
  const userId = req.user.id;
  const orderId = parseInt(req.params.id, 10);

  const result = await db.transaction(async (trx) => {
    const order = await trx('marketplace_orders')
      .where({ id: orderId, seller_id: userId, status: 'listed' })
      .forUpdate()
      .first();

    if (!order) {
      throw new Error('Listing not found or already sold/cancelled');
    }

    // Return item to seller
    if (order.item_type === 'egg') {
      await trx('eggs').where({ id: order.item_id }).update({
        status: 'available',
        collected_at: null,
      });
    }
    // Chicken stays with owner, just remove listing

    await trx('marketplace_orders').where({ id: orderId }).update({ status: 'cancelled' });

    return { order_id: orderId, status: 'cancelled' };
  });

  res.json(result);
});

module.exports = router;
