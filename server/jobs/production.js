const db = require('../config/database');
const EconomyConfig = require('../models/EconomyConfig');

/**
 * Production job — runs every cycle (e.g. every 10 minutes or hourly).
 * Handles: egg production, feed consumption, starvation tracking, death by starvation/lifespan.
 */
async function runProductionCycle() {
  const now = new Date();
  const starvationDeathHours = await EconomyConfig.getNumber('starvation_death_hours');

  // 1) Kill chickens past their lifespan
  await db('chickens')
    .where({ status: 'alive' })
    .where('dies_at', '<=', now)
    .update({ status: 'dead', died_at: now, death_cause: 'lifespan' });

  // 2) Kill chickens that have been starving beyond the limit
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

  for (const { user_id } of usersWithChickens) {
    await processUserFarm(user_id, now);
  }

  // 4) Hatch eggs that have been incubating long enough
  const incubationHours = await EconomyConfig.getNumber('egg_incubation_hours');
  const hatchDeadline = new Date(now.getTime() - incubationHours * 3600000);

  const readyEggs = await db('eggs')
    .where({ status: 'incubating' })
    .where('incubation_started_at', '<=', hatchDeadline)
    .select('*');

  for (const egg of readyEggs) {
    await hatchEgg(egg, now);
  }

  // 5) Grow chicks that have reached maturity
  const chickGrowthDays = await EconomyConfig.getNumber('chick_growth_days');
  const chickFeedNeeded = await EconomyConfig.getNumber('chick_to_adult_feed');
  const growthDeadline = new Date(now.getTime() - chickGrowthDays * 86400000);

  const matureChicks = await db('chicks')
    .where({ status: 'growing' })
    .where('hatched_at', '<=', growthDeadline)
    .where('feed_consumed', '>=', chickFeedNeeded)
    .select('*');

  for (const chick of matureChicks) {
    await promoteChick(chick, now);
  }

  // 6) Expire old uncollected eggs (7 days)
  const eggMaxAgeDays = 7;
  const eggExpireDeadline = new Date(now.getTime() - eggMaxAgeDays * 86400000);
  const expiredCount = await db('eggs')
    .where({ status: 'available' })
    .where('produced_at', '<=', eggExpireDeadline)
    .update({ status: 'expired' });

  return { processed_users: usersWithChickens.length, hatched_eggs: readyEggs.length, promoted_chicks: matureChicks.length, expired_eggs: expiredCount };
}

async function processUserFarm(userId, now) {
  await db.transaction(async (trx) => {
    const user = await trx('users').where({ id: userId }).forUpdate().first();
    const chickens = await trx('chickens')
      .where({ user_id: userId, status: 'alive' })
      .join('chicken_species', 'chickens.species_id', 'chicken_species.id')
      .select('chickens.id', 'chicken_species.eggs_per_day', 'chicken_species.feed_per_day', 'chickens.starvation_started_at');

    if (chickens.length === 0) return;

    // Calculate total feed needed for this cycle
    // Production cycle runs every 10 min = 144 cycles/day, so per-cycle = daily / 144
    const cyclesPerDay = 144;
    let totalFeedNeeded = 0;
    for (const c of chickens) {
      totalFeedNeeded += parseFloat(c.feed_per_day) / cyclesPerDay;
    }

    const currentFeed = parseFloat(user.feed_balance);

    if (currentFeed >= totalFeedNeeded) {
      // Has enough feed: consume and produce
      const newFeed = parseFloat((currentFeed - totalFeedNeeded).toFixed(2));
      await trx('users').where({ id: userId }).update({ feed_balance: newFeed });

      // Clear starvation for all chickens
      await trx('chickens')
        .where({ user_id: userId, status: 'alive' })
        .whereNotNull('starvation_started_at')
        .update({ starvation_started_at: null });

      // Produce eggs (all eggs are fertile by default)
      const eggsToInsert = [];
      for (const c of chickens) {
        const eggsThisCycle = parseFloat(c.eggs_per_day) / cyclesPerDay;
        // Use probability: if random < eggsThisCycle, produce 1 egg
        if (Math.random() < eggsThisCycle) {
          eggsToInsert.push({
            user_id: userId,
            chicken_id: c.id,
            is_fertile: true,
            produced_at: now,
          });
        }
      }

      if (eggsToInsert.length > 0) {
        await trx('eggs').insert(eggsToInsert);
      }
    } else {
      // Not enough feed: mark starvation start
      await trx('chickens')
        .where({ user_id: userId, status: 'alive' })
        .whereNull('starvation_started_at')
        .update({ starvation_started_at: now });
    }
  });
}

async function hatchEgg(egg, now) {
  await db.transaction(async (trx) => {
    // Check hatch success rate (global config)
    const hatchSuccessRate = await EconomyConfig.getNumber('egg_hatch_success_rate') || 0.3;

    if (Math.random() >= hatchSuccessRate) {
      // Hatch failed
      await trx('eggs').where({ id: egg.id }).update({ status: 'failed', hatched_at: now });
      console.log(`[PRODUCTION] Egg #${egg.id} failed to hatch (rate: ${(hatchSuccessRate * 100).toFixed(0)}%)`);
      return;
    }

    const species = await trx('chicken_species').where({ is_active: true }).select('*');
    if (species.length === 0) {
      console.error(`[PRODUCTION] Cannot hatch egg #${egg.id}: no active species`);
      return;
    }

    // Use species_weight for species selection (normalized to sum to 1.0)
    const totalWeight = species.reduce((sum, s) => sum + parseFloat(s.species_weight), 0);
    const roll = Math.random();
    let cumulative = 0;
    let targetSpecies = species[0];

    for (const s of species) {
      cumulative += parseFloat(s.species_weight) / (totalWeight || 1);
      if (roll <= cumulative) {
        targetSpecies = s;
        break;
      }
    }

    await trx('eggs').where({ id: egg.id }).update({ status: 'hatched', hatched_at: now });

    await trx('chicks').insert({
      user_id: egg.user_id,
      egg_id: egg.id,
      target_species_id: targetSpecies.id,
      hatched_at: now,
    });
  });
}

async function promoteChick(chick, now) {
  await db.transaction(async (trx) => {
    const species = await trx('chicken_species').where({ id: chick.target_species_id }).first();
    if (!species) {
      console.error(`[PRODUCTION] Cannot promote chick #${chick.id}: species #${chick.target_species_id} not found`);
      return;
    }

    const diesAt = new Date(now.getTime() + species.lifespan_days * 86400000);

    await trx('chicks').where({ id: chick.id }).update({ status: 'adult', adult_at: now });

    await trx('chickens').insert({
      user_id: chick.user_id,
      species_id: chick.target_species_id,
      born_at: now,
      dies_at: diesAt,
    });
  });
}

module.exports = { runProductionCycle };
