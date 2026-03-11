const { ethers } = require('ethers');
const db = require('../config/database');
const { adjustBalance } = require('../utils/wallet');
const EconomyConfig = require('../models/EconomyConfig');

// USDT BEP20 contract on BSC mainnet
const USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955';

// Platform wallet — all deposits go HERE
const PLATFORM_WALLET = '0x8417C9a00249Da8e4ff7414c5992C08511c28328'.toLowerCase();

// Minimal ERC20 ABI — only Transfer event and decimals
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
];

let lastScannedBlock = 0;

/**
 * Scans the BSC blockchain for incoming USDT BEP20 transfers
 * TO the platform wallet. Matches the sender (from) address to
 * registered users and credits their balance.
 */
async function scanDeposits() {
  const rpcUrl = process.env.BSC_RPC_URL;
  if (!rpcUrl) {
    console.warn('[DEPOSIT] BSC_RPC_URL not configured, skipping scan');
    return { scanned: 0, found: 0, credited: 0 };
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(USDT_CONTRACT, ERC20_ABI, provider);
  const requiredConfirmations = await EconomyConfig.getNumber('bep20_confirmations') || 12;

  const currentBlock = await provider.getBlockNumber();

  // Initialize last scanned block from DB or current - 1000
  if (lastScannedBlock === 0) {
    const latestDeposit = await db('deposits').orderBy('block_number', 'desc').first();
    lastScannedBlock = latestDeposit
      ? latestDeposit.block_number
      : Math.max(0, currentBlock - 1000);
  }

  // Only scan confirmed blocks (current - required confirmations)
  const safeBlock = currentBlock - requiredConfirmations;
  if (safeBlock <= lastScannedBlock) {
    return { scanned: 0, found: 0, credited: 0 };
  }

  // Limit scan range to prevent RPC overload (max 5000 blocks per scan)
  const fromBlock = lastScannedBlock + 1;
  const toBlock = Math.min(safeBlock, fromBlock + 4999);

  // Get all registered wallet addresses — map sender address → userId
  const users = await db('users').select('id', 'wallet_address');
  if (users.length === 0) {
    lastScannedBlock = toBlock;
    return { scanned: toBlock - fromBlock + 1, found: 0, credited: 0 };
  }

  const walletMap = new Map();
  for (const u of users) {
    if (u.wallet_address) {
      walletMap.set(u.wallet_address.toLowerCase(), u.id);
    }
  }

  // Query Transfer events TO the platform wallet only
  let found = 0;
  let credited = 0;

  try {
    const filter = contract.filters.Transfer(null, PLATFORM_WALLET);
    const events = await contract.queryFilter(filter, fromBlock, toBlock);

    for (const event of events) {
      const from = event.args.from.toLowerCase();
      const userId = walletMap.get(from);
      if (!userId) continue; // sender not a registered user

      const txHash = event.transactionHash;

      // Skip if already recorded
      const existing = await db('deposits').where({ tx_hash: txHash }).first();
      if (existing) continue;

      // Parse amount (USDT has 18 decimals on BSC)
      const rawAmount = event.args.value;
      const amount = parseFloat(ethers.formatUnits(rawAmount, 18));

      if (amount <= 0) continue;

      found++;

      const confirmations = currentBlock - event.blockNumber;

      if (confirmations >= requiredConfirmations) {
        // Confirmed — credit user
        await db.transaction(async (trx) => {
          await trx('deposits').insert({
            user_id: userId,
            tx_hash: txHash,
            from_address: from,
            to_address: PLATFORM_WALLET,
            amount: amount.toFixed(2),
            block_number: event.blockNumber,
            confirmations,
            status: 'confirmed',
            confirmed_at: new Date(),
          });

          await adjustBalance(
            trx, userId, parseFloat(amount.toFixed(2)),
            'deposit',
            `BEP20 USDT deposit — tx ${txHash.slice(0, 10)}...`,
            `deposit:${txHash}`
          );
        });
        credited++;
        console.log(`[DEPOSIT] Credited ${amount.toFixed(2)} USDT to user #${userId} — tx ${txHash.slice(0, 10)}...`);
      } else {
        // Pending — track for future confirmation
        await db('deposits').insert({
          user_id: userId,
          tx_hash: txHash,
          from_address: from,
          to_address: PLATFORM_WALLET,
          amount: amount.toFixed(2),
          block_number: event.blockNumber,
          confirmations,
          status: 'pending',
        }).onConflict('tx_hash').ignore();
      }
    }
  } catch (err) {
    console.error(`[DEPOSIT] Error scanning blocks ${fromBlock}-${toBlock}:`, err.message);
    return { scanned: 0, found, credited, error: err.message };
  }

  lastScannedBlock = toBlock;

  // Confirm pending deposits that now have enough confirmations
  const pendingDeposits = await db('deposits').where({ status: 'pending' });
  for (const dep of pendingDeposits) {
    const confirmations = currentBlock - dep.block_number;
    if (confirmations >= requiredConfirmations) {
      await db.transaction(async (trx) => {
        await trx('deposits').where({ id: dep.id }).update({
          status: 'confirmed',
          confirmations,
          confirmed_at: new Date(),
        });

        await adjustBalance(
          trx, dep.user_id, parseFloat(dep.amount),
          'deposit',
          `BEP20 USDT deposit — tx ${dep.tx_hash.slice(0, 10)}...`,
          `deposit:${dep.tx_hash}`
        );
      });
      credited++;
      console.log(`[DEPOSIT] Confirmed pending deposit #${dep.id} — ${dep.amount} USDT to user #${dep.user_id}`);
    } else {
      await db('deposits').where({ id: dep.id }).update({ confirmations });
    }
  }

  return {
    scanned: toBlock - fromBlock + 1,
    from_block: fromBlock,
    to_block: toBlock,
    found,
    credited,
    pending: pendingDeposits.length,
  };
}

module.exports = { scanDeposits };
