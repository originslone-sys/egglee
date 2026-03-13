const { ethers } = require('ethers');
const db = require('../config/database');
const { adjustFeed } = require('../utils/wallet');
const EconomyConfig = require('../models/EconomyConfig');

// USDT BEP20 contract on BSC mainnet
const USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955';

// Platform wallet — all purchases go HERE
const PLATFORM_WALLET = '0x8417C9a00249Da8e4ff7414c5992C08511c28328'.toLowerCase();

// Minimal ERC20 ABI
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

/**
 * Scans pending purchases and verifies them on-chain.
 * Once confirmed, releases the purchased asset (feed or chicken).
 */
async function scanPurchases() {
  const rpcUrl = process.env.BSC_RPC_URL;
  if (!rpcUrl) {
    return { checked: 0, confirmed: 0, failed: 0 };
  }

  const pendingPurchases = await db('pending_purchases').where({ status: 'pending' });
  if (pendingPurchases.length === 0) {
    return { checked: 0, confirmed: 0, failed: 0 };
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const requiredConfirmations = await EconomyConfig.getNumber('bep20_confirmations') || 12;
  const currentBlock = await provider.getBlockNumber();

  let confirmed = 0;
  let failed = 0;

  for (const purchase of pendingPurchases) {
    try {
      const receipt = await provider.getTransactionReceipt(purchase.tx_hash);

      if (!receipt) {
        // Transaction not yet mined — check if too old (30 min timeout)
        const ageMs = Date.now() - new Date(purchase.created_at).getTime();
        if (ageMs > 30 * 60 * 1000) {
          await db('pending_purchases').where({ id: purchase.id }).update({
            status: 'failed',
          });
          failed++;
          console.log(`[PURCHASE] Timed out: purchase #${purchase.id} — tx ${purchase.tx_hash.slice(0, 10)}...`);
        }
        continue;
      }

      // Transaction was reverted
      if (receipt.status === 0) {
        await db('pending_purchases').where({ id: purchase.id }).update({
          status: 'failed',
          block_number: receipt.blockNumber,
        });
        failed++;
        console.log(`[PURCHASE] Reverted: purchase #${purchase.id} — tx ${purchase.tx_hash.slice(0, 10)}...`);
        continue;
      }

      const confirmations = currentBlock - receipt.blockNumber;
      await db('pending_purchases').where({ id: purchase.id }).update({
        block_number: receipt.blockNumber,
        confirmations,
      });

      if (confirmations < requiredConfirmations) {
        continue; // Not enough confirmations yet
      }

      // Verify the transfer event: correct amount, to platform wallet, from user wallet
      const iface = new ethers.Interface(ERC20_ABI);
      const transferTopic = iface.getEvent('Transfer').topicHash;

      const transferLog = receipt.logs.find(log =>
        log.address.toLowerCase() === USDT_CONTRACT.toLowerCase() &&
        log.topics[0] === transferTopic
      );

      if (!transferLog) {
        await db('pending_purchases').where({ id: purchase.id }).update({ status: 'failed' });
        failed++;
        console.log(`[PURCHASE] No USDT transfer found in tx: purchase #${purchase.id}`);
        continue;
      }

      const decoded = iface.parseLog({ topics: transferLog.topics, data: transferLog.data });
      const fromAddr = decoded.args.from.toLowerCase();
      const toAddr = decoded.args.to.toLowerCase();
      const transferAmount = parseFloat(ethers.formatUnits(decoded.args.value, 18));

      // Validate: correct recipient
      if (toAddr !== PLATFORM_WALLET) {
        await db('pending_purchases').where({ id: purchase.id }).update({ status: 'failed' });
        failed++;
        console.log(`[PURCHASE] Wrong recipient: purchase #${purchase.id}`);
        continue;
      }

      // Validate: from the user's wallet
      if (fromAddr !== purchase.from_address.toLowerCase()) {
        await db('pending_purchases').where({ id: purchase.id }).update({ status: 'failed' });
        failed++;
        console.log(`[PURCHASE] Wrong sender: purchase #${purchase.id}`);
        continue;
      }

      // Validate: correct amount (allow 0.5% tolerance for rounding)
      const expectedAmount = parseFloat(purchase.expected_amount);
      if (transferAmount < expectedAmount * 0.995) {
        await db('pending_purchases').where({ id: purchase.id }).update({ status: 'failed' });
        failed++;
        console.log(`[PURCHASE] Insufficient amount: purchase #${purchase.id} — got ${transferAmount}, expected ${expectedAmount}`);
        continue;
      }

      // All checks passed — release the asset
      await releasePurchase(purchase);
      confirmed++;
      console.log(`[PURCHASE] Confirmed: purchase #${purchase.id} — ${purchase.purchase_type}`);

    } catch (err) {
      console.error(`[PURCHASE] Error checking purchase #${purchase.id}:`, err.message);
    }
  }

  return { checked: pendingPurchases.length, confirmed, failed };
}

/**
 * Release a confirmed purchase — credit feed or create chicken.
 */
async function releasePurchase(purchase) {
  const data = typeof purchase.purchase_data === 'string'
    ? JSON.parse(purchase.purchase_data)
    : purchase.purchase_data;

  await db.transaction(async (trx) => {
    if (purchase.purchase_type === 'feed') {
      await adjustFeed(trx, purchase.user_id, data.quantity);
    } else if (purchase.purchase_type === 'chicken') {
      const species = await trx('chicken_species').where({ id: data.species_id }).first();
      if (!species) throw new Error('Species not found');

      const now = new Date();
      const diesAt = new Date(now.getTime() + species.lifespan_days * 86400000);
      await trx('chickens').insert({
        user_id: purchase.user_id,
        species_id: species.id,
        born_at: now,
        dies_at: diesAt,
      });
    }

    await trx('pending_purchases').where({ id: purchase.id }).update({
      status: 'confirmed',
      confirmed_at: new Date(),
    });
  });
}

module.exports = { scanPurchases };
