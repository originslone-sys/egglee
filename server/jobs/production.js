const db = require('../config/database');
const EconomyConfig = require('../models/EconomyConfig');

// Execution lock to prevent overlapping cycles
let isRunning = false;

// Process items in parallel with concurrency limit
async function parallelBatch(items, fn, concurrency = 10) {
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.all(batch.map(fn));
  }
}

/**
 * Production job — runs every cycle (e.g. every 10 minutes).
 * Handles: egg production, feed consumption, starvation tracking, death by starvation/lifespan.
 */
async function runProductionCycle() {
  if (isRunning) {
    console.log('[PRODUCTION] Cycle already running, skipping');
    return { skipped: true };
  }

  isRunning = true;
  try {
    return await _runProductionCycle();
  } finally {
    isRunning = false;
  }
}

async function _runProductionCycle() {
  const now = new Date();
  const starvationDeathHours = await EconomyConfig.getNumber('starvation_death_hours') || 72;

  // 1) Kill chickens past their lifespan (batch UPDATE)
  await db('chickens')
    .where({ status: 'alive' })
    .where('dies_at', '<=', now)
    .update({ status: 'dead', died_at: now, death_cause: 'lifespan' });

  // 2) Kill chickens that have been starving beyond the limit (batch UPDATE)
  const starvationDeadline = new Date(now.getTime() - starvationDeathHours * 3600000);
  await db('chickens')
    .where({ status: 'alive' })
    .whereNotNull('starvation_started_at')
    .where('starvation_started_at', '<=', starvationDeadline)
    .update({ status: 'dead', died_at: now, death_cause: 'starvation' });

  // 3) Process alive chickens per user — consume feed and produce eggs
  const usersWithChickens = await db('chickens')
    .where({ status: 'alive' })
    .distinct('user_id');

  await parallelBatch(
    usersWithChickens.map(r => r.user_id),
    (userId) => processUserFarm(userId, now),
    10
  );

  // 4) Hatch eggs in batch
  const hatchedCount = await batchHatchEggs(now);

  // 5) Promote chicks in batch
  const promotedCount = await batchPromoteChicks(now);

  // 6) Expire old uncollected eggs (7 days) — batch UPDATE
  const eggMaxAgeDays = 7;
  const eggExpireDeadline = new Date(now.getTime() - eggMaxAgeDays * 86400000);
  const expiredCount = await db('eggs')
    .where({ status: 'available' })
    .where('produced_at', '<=', eggExpireDeadline)
    .update({ status: 'expired' });

  return {
    processed_users: usersWithChickens.length,
    hatched_eggs: hatchedCount,
    promoted_chicks: promotedCount,
    expired_eggs: expiredCount,
  };
}

async function processUserFarm(userId, now) {
  await db.transaction(async (trx) => {
    const user = await trx('users').where({ id: userId }).forUpdate().first();
    const chickens = await trx('chickens')
      .where({ user_id: userId, status: 'alive' })
      .join('chicken_species', 'chickens.species_id', 'chicken_species.id')
      .select('chickens.id', 'chicken_species.eggs_per_day', 'chicken_species.feed_per_day', 'chickens.starvation_started_at', 'chickens.egg_accumulator');

    if (chickens.length === 0) return;

    const cyclesPerDay = 144;
    let totalFeedNeeded = 0;
    for (const c of chickens) {
      totalFeedNeeded += parseFloat(c.feed_per_day) / cyclesPerDay;
    }

    const currentFeed = parseFloat(user.feed_balance);

    if (currentFeed >= totalFeedNeeded) {
      const newFeed = parseFloat((currentFeed - totalFeedNeeded).toFixed(2));
      await trx('users').where({ id: userId }).update({ feed_balance: newFeed });

      await trx('chickens')
        .where({ user_id: userId, status: 'alive' })
        .whereNotNull('starvation_started_at')
        .update({ starvation_started_at: null });

      // Track feed consumed per chicken (batch by species feed rate)
      const feedByChicken = new Map();
      for (const c of chickens) {
        const feedThisCycle = parseFloat((parseFloat(c.feed_per_day) / cyclesPerDay).toFixed(4));
        feedByChicken.set(c.id, feedThisCycle);
      }
      // Group chickens by feed amount for batch updates
      const feedGroups = new Map();
      for (const [id, feed] of feedByChicken) {
        const key = feed.toString();
        if (!feedGroups.has(key)) feedGroups.set(key, []);
        feedGroups.get(key).push(id);
      }
      for (const [feed, ids] of feedGroups) {
        await trx('chickens').whereIn('id', ids).increment('total_feed_consumed', parseFloat(feed));
      }

      // Accumulate fractional eggs and produce whole eggs when accumulator >= 1.0
      const eggsToInsert = [];
      const accumulatorUpdates = new Map(); // chickenId -> newAccumulator

      for (const c of chickens) {
        const increment = parseFloat(c.eggs_per_day) / cyclesPerDay;
        let accumulator = parseFloat(c.egg_accumulator || 0) + increment;
        const wholeEggs = Math.floor(accumulator);
        accumulator -= wholeEggs;

        accumulatorUpdates.set(c.id, parseFloat(accumulator.toFixed(6)));

        for (let i = 0; i < wholeEggs; i++) {
          eggsToInsert.push({
            user_id: userId,
            chicken_id: c.id,
            is_fertile: true,
            produced_at: now,
          });
        }
      }

      // Batch update accumulators grouped by value
      const accGroups = new Map();
      for (const [id, acc] of accumulatorUpdates) {
        const key = acc.toString();
        if (!accGroups.has(key)) accGroups.set(key, []);
        accGroups.get(key).push(id);
      }
      for (const [acc, ids] of accGroups) {
        await trx('chickens').whereIn('id', ids).update({ egg_accumulator: parseFloat(acc) });
      }

      if (eggsToInsert.length > 0) {
        await trx('eggs').insert(eggsToInsert);
        // Track eggs produced per chicken (batch update)
        const eggCountByChicken = new Map();
        for (const egg of eggsToInsert) {
          eggCountByChicken.set(egg.chicken_id, (eggCountByChicken.get(egg.chicken_id) || 0) + 1);
        }
        for (const [chickenId, count] of eggCountByChicken) {
          await trx('chickens').where({ id: chickenId }).increment('total_eggs_produced', count);
        }
      }
    } else {
      await trx('chickens')
        .where({ user_id: userId, status: 'alive' })
        .whereNull('starvation_started_at')
        .update({ starvation_started_at: now });
    }
  });
}

async function batchHatchEggs(now) {
  const incubationHours = await EconomyConfig.getNumber('egg_incubation_hours') || 72;
  const hatchDeadline = new Date(now.getTime() - incubationHours * 3600000);

  const readyEggs = await db('eggs')
    .where({ status: 'incubating' })
    .where('incubation_started_at', '<=', hatchDeadline)
    .select('*');

  if (readyEggs.length === 0) return 0;

  const hatchSuccessRate = await EconomyConfig.getNumber('egg_hatch_success_rate') || 0.3;
  const species = await db('chicken_species').where({ is_active: true }).select('*');

  if (species.length === 0) {
    console.error('[PRODUCTION] Cannot hatch eggs: no active species');
    return 0;
  }

  const totalWeight = species.reduce((sum, s) => sum + parseFloat(s.species_weight), 0);

  function rollSpecies() {
    const roll = Math.random();
    let cumulative = 0;
    for (const s of species) {
      cumulative += parseFloat(s.species_weight) / (totalWeight || 1);
      if (roll <= cumulative) return s;
    }
    return species[0];
  }

  // Separate eggs into success/fail based on hatch rate
  const failedEggs = [];
  const successEggs = [];

  for (const egg of readyEggs) {
    if (Math.random() >= hatchSuccessRate) {
      failedEggs.push(egg);
    } else {
      successEggs.push(egg);
    }
  }

  // Batch update failed eggs
  if (failedEggs.length > 0) {
    const failedIds = failedEggs.map(e => e.id);
    await db('eggs').whereIn('id', failedIds).update({ status: 'failed', hatched_at: now });
    console.log(`[PRODUCTION] ${failedIds.length} eggs failed to hatch (rate: ${(hatchSuccessRate * 100).toFixed(0)}%)`);
  }

  // Batch process successful eggs
  if (successEggs.length > 0) {
    const successIds = successEggs.map(e => e.id);
    await db('eggs').whereIn('id', successIds).update({ status: 'hatched', hatched_at: now });

    const chicksToInsert = successEggs.map(egg => ({
      user_id: egg.user_id,
      egg_id: egg.id,
      target_species_id: rollSpecies().id,
      hatched_at: now,
    }));

    // Insert chicks in chunks of 500 to avoid query size limits
    for (let i = 0; i < chicksToInsert.length; i += 500) {
      await db('chicks').insert(chicksToInsert.slice(i, i + 500));
    }
  }

  return successEggs.length;
}

async function batchPromoteChicks(now) {
  const chickGrowthDays = await EconomyConfig.getNumber('chick_growth_days') || 12;
  const chickFeedNeeded = await EconomyConfig.getNumber('chick_to_adult_feed') || 2.0;
  const growthDeadline = new Date(now.getTime() - chickGrowthDays * 86400000);

  const matureChicks = await db('chicks')
    .where({ status: 'growing' })
    .where('hatched_at', '<=', growthDeadline)
    .where('feed_consumed', '>=', chickFeedNeeded)
    .select('*');

  if (matureChicks.length === 0) return 0;

  // Load all needed species in one query
  const speciesIds = [...new Set(matureChicks.map(c => c.target_species_id))];
  const speciesRows = await db('chicken_species').whereIn('id', speciesIds).select('*');
  const speciesMap = new Map(speciesRows.map(s => [s.id, s]));

  // Separate valid from invalid
  const validChicks = [];
  for (const chick of matureChicks) {
    const species = speciesMap.get(chick.target_species_id);
    if (!species) {
      console.error(`[PRODUCTION] Cannot promote chick #${chick.id}: species #${chick.target_species_id} not found`);
      continue;
    }
    validChicks.push({ chick, species });
  }

  if (validChicks.length === 0) return 0;

  // Batch update chicks status
  const chickIds = validChicks.map(v => v.chick.id);
  await db('chicks').whereIn('id', chickIds).update({ status: 'adult', adult_at: now });

  // Batch insert new chickens
  const chickensToInsert = validChicks.map(({ chick, species }) => ({
    user_id: chick.user_id,
    species_id: chick.target_species_id,
    born_at: now,
    dies_at: new Date(now.getTime() + species.lifespan_days * 86400000),
  }));

  for (let i = 0; i < chickensToInsert.length; i += 500) {
    await db('chickens').insert(chickensToInsert.slice(i, i + 500));
  }

  return validChicks.length;
}

module.exports = { runProductionCycle };
