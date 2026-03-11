const { Router } = require('express');
const crypto = require('crypto');
const { ethers } = require('ethers');
const db = require('../config/database');
const { signToken } = require('../middleware/auth');
const EconomyConfig = require('../models/EconomyConfig');

const router = Router();

// GET /api/auth/nonce?wallet=0x...
// Returns a nonce for the wallet to sign
router.get('/nonce', async (req, res) => {
  const wallet = req.query.wallet;
  if (!wallet || !ethers.isAddress(wallet)) {
    return res.status(400).json({ error: 'Valid wallet address required' });
  }

  const address = wallet.toLowerCase();
  let user = await db('users').where({ wallet_address: address }).first();

  if (!user) {
    const allowReg = await EconomyConfig.getBoolean('allow_new_registrations');
    if (!allowReg) {
      return res.status(403).json({ error: 'New registrations are currently disabled' });
    }
  }

  const nonce = crypto.randomBytes(32).toString('hex');

  if (user) {
    await db('users').where({ id: user.id }).update({ auth_nonce: nonce });
  } else {
    // Pre-create user row with nonce (not yet authenticated)
    await db('users').insert({
      wallet_address: address,
      auth_nonce: nonce,
      role: (process.env.ADMIN_WALLETS || '').toLowerCase().split(',').includes(address) ? 'admin' : 'user',
    });
  }

  res.json({
    nonce,
    message: `Sign this message to authenticate with Galinha Farm:\n\nNonce: ${nonce}`,
  });
});

// POST /api/auth/verify
// Verifies the signed nonce and returns a JWT
router.post('/verify', async (req, res) => {
  const { wallet, signature } = req.body;
  if (!wallet || !signature) {
    return res.status(400).json({ error: 'wallet and signature required' });
  }

  const address = wallet.toLowerCase();
  const user = await db('users').where({ wallet_address: address }).first();
  if (!user) {
    return res.status(404).json({ error: 'Request a nonce first' });
  }

  const message = `Sign this message to authenticate with Galinha Farm:\n\nNonce: ${user.auth_nonce}`;

  try {
    const recovered = ethers.verifyMessage(message, signature).toLowerCase();
    if (recovered !== address) {
      return res.status(401).json({ error: 'Signature verification failed' });
    }
  } catch {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Rotate nonce so it can't be reused
  const newNonce = crypto.randomBytes(32).toString('hex');

  const isFirstLogin = !user.accepted_terms;

  // Re-check admin role on every login (in case ADMIN_WALLETS env changed)
  const adminWallets = (process.env.ADMIN_WALLETS || '').toLowerCase().split(',').filter(Boolean);
  const expectedRole = adminWallets.includes(address) ? 'admin' : user.role;

  await db('users').where({ id: user.id }).update({
    auth_nonce: newNonce,
    last_login_at: db.fn.now(),
    accepted_terms: true,
    role: expectedRole,
  });

  // Onboarding: give free chicken + feed on first login
  if (isFirstLogin) {
    await db.transaction(async (trx) => {
      const freeFeed = await EconomyConfig.getNumber('onboarding_free_feed');
      await trx('users').where({ id: user.id }).update({ feed_balance: freeFeed || 5 });

      const comum = await trx('chicken_species').where({ name: 'Comum' }).first();
      if (comum) {
        const now = new Date();
        const diesAt = new Date(now.getTime() + comum.lifespan_days * 86400000);
        await trx('chickens').insert({
          user_id: user.id,
          species_id: comum.id,
          is_free_chicken: true,
          born_at: now,
          dies_at: diesAt,
        });
      }

      await trx('wallet_ledger').insert({
        user_id: user.id,
        type: 'onboarding_bonus',
        amount: 0,
        balance_after: 0,
        description: `Onboarding: 1 free Comum chicken + ${freeFeed || 5} feed units`,
      });
    });
  }

  const token = signToken({ ...user, role: expectedRole });
  res.json({
    token,
    first_login: isFirstLogin,
    user: {
      id: user.id,
      wallet_address: user.wallet_address,
      role: expectedRole,
    },
  });
});

// POST /api/auth/bootstrap
// Opens registrations if no users exist yet, or via JWT_SECRET
router.post('/bootstrap', async (req, res) => {
  const userCount = await db('users').count('* as cnt').first();
  const count = parseInt(userCount.cnt, 10);

  if (count === 0) {
    await EconomyConfig.set('allow_new_registrations', 'true');
    return res.json({ ok: true, message: 'Registrations enabled (no users exist)' });
  }

  const { secret } = req.body || {};
  if (secret && secret === process.env.JWT_SECRET) {
    await EconomyConfig.set('allow_new_registrations', 'true');
    return res.json({ ok: true, message: 'Registrations enabled via secret' });
  }

  return res.status(403).json({ error: 'Cannot bootstrap: users exist and no valid secret provided' });
});

module.exports = router;
