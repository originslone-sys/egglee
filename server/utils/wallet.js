const db = require('../config/database');

/**
 * Atomically adjusts a user's USDT balance and records the ledger entry.
 * Must be called inside a transaction (trx) for safety.
 */
async function adjustBalance(trx, userId, amount, type, description = null, referenceId = null) {
  const user = await trx('users').where({ id: userId }).forUpdate().first();
  if (!user) throw new Error('User not found');

  const newBalance = parseFloat(user.balance_usdt) + amount;
  if (newBalance < 0) throw new Error('Insufficient balance');

  await trx('users').where({ id: userId }).update({ balance_usdt: newBalance });

  await trx('wallet_ledger').insert({
    user_id: userId,
    type,
    amount,
    balance_after: newBalance,
    reference_id: referenceId,
    description,
  });

  return newBalance;
}

/**
 * Adjusts feed balance. Positive = add feed, negative = consume feed.
 */
async function adjustFeed(trx, userId, amount) {
  const user = await trx('users').where({ id: userId }).forUpdate().first();
  if (!user) throw new Error('User not found');

  const newFeed = parseFloat(user.feed_balance) + amount;
  if (newFeed < 0) throw new Error('Insufficient feed');

  await trx('users').where({ id: userId }).update({ feed_balance: newFeed });
  return newFeed;
}

module.exports = { adjustBalance, adjustFeed };
