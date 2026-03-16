/**
 * client.js — Client Dashboard Controller for Egglee
 */
(function () {
  // ── Helpers ─────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function show(el) { if (el) el.style.display = ''; }
  function hide(el) { if (el) el.style.display = 'none'; }
  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function toast(msg, isError = false) {
    const t = document.createElement('div');
    t.className = `toast ${isError ? 'toast-error' : 'toast-ok'}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  function shortWallet(addr) {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  function formatCountdown(targetMs) {
    const diff = targetMs - Date.now();
    if (diff <= 0) return 'Ready!';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function formatCountdownDays(targetMs) {
    const diff = targetMs - Date.now();
    if (diff <= 0) return 'Ready!';
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    if (d > 0) return `${d}d ${h}h`;
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  // ── Auth ────────────────────────────────────────
  const connectBtn = $('connect-btn');
  const logoutBtn = $('logout-btn');
  const walletLabel = $('wallet-label');

  function updateAuthUI() {
    if (API.isLoggedIn()) {
      if (connectBtn) hide(connectBtn);
      if (logoutBtn) show(logoutBtn);
      if (walletLabel) walletLabel.textContent = shortWallet(API.getUser()?.wallet_address);
    } else {
      if (connectBtn) show(connectBtn);
      if (logoutBtn) hide(logoutBtn);
    }
  }

  // ── Terms Modal ─────────────────────────────────
  const termsModal = $('terms-modal');
  const termsCheckbox = $('terms-checkbox');
  const termsAcceptBtn = $('terms-accept-btn');

  termsCheckbox?.addEventListener('change', () => {
    if (termsAcceptBtn) termsAcceptBtn.disabled = !termsCheckbox.checked;
  });

  function hasAcceptedTerms() {
    return localStorage.getItem('gf_terms_accepted') === 'true';
  }

  function showWelcomeMessage() {
    const overlay = $('welcome-modal');
    if (overlay) {
      show(overlay);
      const closeBtn = $('welcome-close-btn');
      closeBtn?.addEventListener('click', () => hide(overlay), { once: true });
    }
  }

  function showTermsModal() {
    return new Promise((resolve) => {
      if (termsModal) show(termsModal);
      termsAcceptBtn?.addEventListener('click', () => {
        localStorage.setItem('gf_terms_accepted', 'true');
        if (termsModal) hide(termsModal);
        resolve(true);
      }, { once: true });
    });
  }

  connectBtn?.addEventListener('click', async () => {
    // Show terms first if not yet accepted
    if (!hasAcceptedTerms()) {
      await showTermsModal();
    }

    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';
    try {
      const authData = await API.connectMetaMask();
      updateAuthUI();

      if (authData.first_login) {
        showWelcomeMessage();
      } else {
        toast('Connected successfully!');
      }
      loadFarm();
    } catch (e) {
      toast(e.message, true);
    } finally {
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect Wallet';
    }
  });

  logoutBtn?.addEventListener('click', () => {
    API.logout();
    updateAuthUI();
    location.reload();
  });

  updateAuthUI();

  // ── Section Navigation ─────────────────────────
  const navBtns = document.querySelectorAll('.client-nav button[data-section]');
  const sections = document.querySelectorAll('.client-section');

  function switchSection(name) {
    navBtns.forEach(b => b.classList.toggle('active', b.dataset.section === name));
    sections.forEach(s => s.classList.toggle('active', s.id === 'section-' + name));
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => switchSection(btn.dataset.section));
  });

  // ── Farm Data ──────────────────────────────────
  let farmData = null;

  const el = {
    chickens: $('metric-chickens'),
    eggs: $('metric-eggs'),
    feed: $('metric-feed'),
    wallet: $('metric-wallet'),
    farmStatus: $('farm-status'),
    collectBtn: $('collect-btn'),
    feedBtn: $('feed-btn'),
    buyEggBtn: $('buy-egg-btn'),
    eggQty: $('egg-qty'),
    buyChickenBtn: $('buy-chicken-btn'),
    speciesSelect: $('species-select'),
    withdrawBtn: $('withdraw-btn'),
    withdrawAmount: $('withdraw-amount'),
    chickenList: $('chicken-list'),
    ledgerBody: $('ledger-body'),
  };

  // ── Farm Map 2D ────────────────────────────────
  const entityInfo = $('farm-entity-info');
  const entityDetails = $('entity-details');
  const entityClose = $('entity-close');

  if (typeof FarmMap !== 'undefined') {
    FarmMap.init('farm-canvas', (entity) => {
      if (!entityInfo || !entityDetails) return;
      entityInfo.style.display = '';

      if (entity.type === 'chicken') {
        const c = entity.data;
        const daysLeft = Math.max(0, Math.ceil((new Date(c.dies_at) - Date.now()) / 86400000));
        const status = c.starvation_started_at
          ? '<span class="status-pill danger">Starving</span>'
          : '<span class="status-pill ok">Healthy</span>';
        const displayName = c.name || c.species;
        entityDetails.innerHTML = `
          <div class="entity-details-grid">
            <div class="entity-detail"><span class="detail-label">Name</span><span class="detail-value">${esc(displayName)}</span></div>
            <div class="entity-detail"><span class="detail-label">Species</span><span class="detail-value">${esc(c.species)}</span></div>
            <div class="entity-detail"><span class="detail-label">ID</span><span class="detail-value">#${c.id}</span></div>
            <div class="entity-detail"><span class="detail-label">Status</span><span class="detail-value">${status}</span></div>
            <div class="entity-detail"><span class="detail-label">Days Left</span><span class="detail-value">${daysLeft}d</span></div>
            <div class="entity-detail"><span class="detail-label">Eggs Produced</span><span class="detail-value">${parseInt(c.total_eggs_produced || 0, 10)}</span></div>
            <div class="entity-detail"><span class="detail-label">Feed Consumed</span><span class="detail-value">${parseFloat(c.total_feed_consumed || 0).toFixed(1)}</span></div>
            <div class="entity-detail"><span class="detail-label">Born</span><span class="detail-value">${new Date(c.born_at).toLocaleDateString()}</span></div>
          </div>`;
      } else if (entity.type === 'chick') {
        const c = entity.data;
        const chickTarget = (farmData && farmData.chick_feed_needed) || 2.0;
        const feedPct = Math.min(100, ((parseFloat(c.feed_consumed) / chickTarget) * 100)).toFixed(0);
        entityDetails.innerHTML = `
          <div class="entity-details-grid">
            <div class="entity-detail"><span class="detail-label">Type</span><span class="detail-value">Growing Chick</span></div>
            <div class="entity-detail"><span class="detail-label">Target</span><span class="detail-value">${c.target_species}</span></div>
            <div class="entity-detail"><span class="detail-label">Feed Progress</span><span class="detail-value">${feedPct}%</span></div>
            <div class="entity-detail"><span class="detail-label">Hatched</span><span class="detail-value">${new Date(c.hatched_at).toLocaleDateString()}</span></div>
          </div>`;
      } else if (entity.type === 'egg') {
        entityDetails.innerHTML = `
          <div class="entity-details-grid">
            <div class="entity-detail"><span class="detail-label">Type</span><span class="detail-value">Egg</span></div>
            <div class="entity-detail"><span class="detail-label">Status</span><span class="detail-value">Available</span></div>
          </div>`;
      }
    });
  }

  entityClose?.addEventListener('click', () => {
    if (entityInfo) entityInfo.style.display = 'none';
  });

  // ── Render Farm ────────────────────────────────
  function renderFarm() {
    if (!farmData) return;
    if (el.chickens) el.chickens.textContent = String(farmData.chickens.length);
    if (el.eggs) el.eggs.textContent = String(farmData.eggs_available);
    if (el.feed) el.feed.textContent = `${farmData.feed_balance.toFixed(1)}`;
    if (el.wallet) el.wallet.textContent = `${farmData.balance_usdt.toFixed(2)}`;

    // Status banner
    if (el.farmStatus) {
      if (farmData.feed_balance <= 0) {
        el.farmStatus.textContent = 'Feed depleted: chickens may die without food.';
        el.farmStatus.className = 'farm-status-banner warning';
      } else if (farmData.feed_balance <= 3) {
        el.farmStatus.textContent = 'Low feed! Buy more feed to maintain production.';
        el.farmStatus.className = 'farm-status-banner warning';
      } else {
        el.farmStatus.textContent = 'Farm stable. Production running normally.';
        el.farmStatus.className = 'farm-status-banner ok';
      }
    }

    // Update farm map
    if (typeof FarmMap !== 'undefined') FarmMap.update(farmData);

    // Chicken list
    if (el.chickenList) {
      if (farmData.chickens.length === 0) {
        el.chickenList.innerHTML = '<p class="text-soft">No active chickens. Buy one to start!</p>';
      } else {
        el.chickenList.innerHTML = '<div class="chicken-grid">' + farmData.chickens.map(c => {
          const starving = c.starvation_started_at;
          const bg = starving ? 'var(--danger-dim)' : 'var(--success-dim)';
          const daysLeft = Math.max(0, Math.ceil((new Date(c.dies_at) - Date.now()) / 86400000));
          const displayName = c.name || c.species;
          const feedConsumed = parseFloat(c.total_feed_consumed || 0).toFixed(1);
          const eggsProduced = parseInt(c.total_eggs_produced || 0, 10);
          return `<div class="chicken-card">
            <div class="chicken-card-header">
              <div class="chicken-avatar" style="background:${bg}">&#x1f414;</div>
              <div class="chicken-card-title">
                <div class="chicken-display-name">
                  <span id="cname-${c.id}">${esc(displayName)}</span>
                  <button class="chicken-name-edit" onclick="window.__renameChicken(${c.id})" title="Rename">&#x270F;&#xFE0F;</button>
                  ${starving ? '<span class="status-pill danger">Starving</span>' : ''}
                </div>
                <div class="chicken-species-tag">${esc(c.species)} &middot; #${c.id}</div>
              </div>
            </div>
            <div class="chicken-card-stats">
              <div class="chicken-stat">
                <div class="chicken-stat-value">${eggsProduced}</div>
                <div class="chicken-stat-label">Eggs</div>
              </div>
              <div class="chicken-stat">
                <div class="chicken-stat-value">${feedConsumed}</div>
                <div class="chicken-stat-label">Feed Used</div>
              </div>
              <div class="chicken-stat">
                <div class="chicken-stat-value">${daysLeft}d</div>
                <div class="chicken-stat-label">Life Left</div>
              </div>
            </div>
            <div class="chicken-card-footer">
              <span>Born ${new Date(c.born_at).toLocaleDateString()}</span>
              <span class="status-pill ${starving ? 'danger' : 'ok'}">${starving ? 'Starving' : 'Healthy'}</span>
            </div>
          </div>`;
        }).join('') + '</div>';
      }
    }
  }

  // ── Load Farm ──────────────────────────────────
  async function loadFarm() {
    if (!API.isLoggedIn()) return;
    try {
      farmData = await API.client.farm();
      renderFarm();
      loadSpecies();
      loadLedger();
      loadPurchases();
      loadEggsForIncubation();
      loadChickFeedSelect();
      renderIncubatingEggs();
      renderGrowingChicks();
      renderHatchHistory();
      loadChickHistory();
      loadDeadChickens();
    } catch (e) {
      toast(e.message, true);
    }
  }

  async function loadSpecies() {
    if (!el.speciesSelect) return;
    try {
      const species = await API.client.species();
      el.speciesSelect.innerHTML = species.map(s =>
        `<option value="${s.id}" data-price="${parseFloat(s.purchase_price)}">${s.name} — ${parseFloat(s.purchase_price).toFixed(2)} USDT (${parseFloat(s.eggs_per_day)} eggs/day)</option>`
      ).join('');
    } catch (_) { /* ignore */ }
  }

  async function loadLedger() {
    if (!el.ledgerBody) return;
    try {
      const { entries } = await API.client.ledger(1);
      if (entries.length === 0) {
        el.ledgerBody.innerHTML = '<tr><td colspan="4" class="text-soft">No transactions yet.</td></tr>';
      } else {
        el.ledgerBody.innerHTML = entries.slice(0, 10).map(e => `
          <tr>
            <td>${new Date(e.created_at).toLocaleString()}</td>
            <td>${e.type}</td>
            <td class="${parseFloat(e.amount) >= 0 ? 'text-green' : 'text-red'}">${parseFloat(e.amount) >= 0 ? '+' : ''}${parseFloat(e.amount).toFixed(2)}</td>
            <td>${parseFloat(e.balance_after).toFixed(2)}</td>
          </tr>
        `).join('');
      }
    } catch (_) { /* ignore */ }
  }

  // ── Purchase History ───────────────────────────
  const purchasesBody = $('purchases-body');

  async function loadPurchases() {
    if (!purchasesBody || !API.isLoggedIn()) return;
    try {
      const { purchases } = await API.client.purchases(1);
      if (purchases.length === 0) {
        purchasesBody.innerHTML = '<tr><td colspan="5" class="text-soft">No purchases yet.</td></tr>';
      } else {
        purchasesBody.innerHTML = purchases.slice(0, 10).map(p => {
          const statusClass = p.status === 'confirmed' ? 'ok' : p.status === 'failed' ? 'danger' : 'warn';
          const txShort = p.tx_hash ? p.tx_hash.slice(0, 10) + '...' : '';
          const typeLabel = p.purchase_type === 'feed' ? 'Feed' : p.purchase_type === 'eggs' ? 'Eggs' : 'Chicken';
          return `<tr>
            <td>${new Date(p.created_at).toLocaleString()}</td>
            <td>${typeLabel}</td>
            <td>${parseFloat(p.expected_amount).toFixed(2)} USDT</td>
            <td><span class="status-pill ${statusClass}">${p.status}</span></td>
            <td title="${esc(p.tx_hash || '')}">${esc(txShort)}</td>
          </tr>`;
        }).join('');
      }
    } catch (_) { /* ignore */ }
  }

  // ── Actions ────────────────────────────────────
  el.collectBtn?.addEventListener('click', async () => {
    el.collectBtn.disabled = true;
    try {
      const r = await API.client.collectEggs();
      toast(`Collected ${r.collected} eggs — earned ${r.earned.toFixed(2)} USDT`);
      loadFarm();
    } catch (e) { toast(e.message, true); }
    el.collectBtn.disabled = false;
  });

  // Buy Feed — pay directly via MetaMask
  el.feedBtn?.addEventListener('click', async () => {
    el.feedBtn.disabled = true;
    el.feedBtn.textContent = 'Loading...';
    try {
      const { feed_unit_price } = await API.client.feedPrice();
      const quantity = 10;
      const cost = parseFloat((quantity * feed_unit_price).toFixed(2));

      el.feedBtn.textContent = `Pay ${cost} USDT...`;
      const txHash = await API.sendPayment(cost);

      el.feedBtn.textContent = 'Confirming...';
      toast('Transaction sent! Feed will be credited after blockchain confirmation.');

      await API.client.buyFeed(quantity, txHash);
      loadFarm();
    } catch (e) {
      if (e.code === 4001) {
        toast('Transaction cancelled.', true);
      } else {
        toast(e.message, true);
      }
    } finally {
      el.feedBtn.disabled = false;
      el.feedBtn.textContent = 'Buy Feed';
    }
  });

  // Buy Eggs — pay directly via MetaMask
  el.buyEggBtn?.addEventListener('click', async () => {
    const qty = parseInt(el.eggQty?.value, 10);
    if (!qty || qty <= 0) { toast('Enter a valid quantity', true); return; }

    el.buyEggBtn.disabled = true;
    el.buyEggBtn.textContent = 'Loading...';
    try {
      const { egg_purchase_price } = await API.client.eggPrice();
      const cost = parseFloat((qty * egg_purchase_price).toFixed(2));

      el.buyEggBtn.textContent = `Pay ${cost} USDT...`;
      const txHash = await API.sendPayment(cost);

      el.buyEggBtn.textContent = 'Confirming...';
      toast('Transaction sent! Eggs will be credited after blockchain confirmation.');

      await API.client.buyEggs(qty, txHash);
      loadFarm();
    } catch (e) {
      if (e.code === 4001) {
        toast('Transaction cancelled.', true);
      } else {
        toast(e.message, true);
      }
    } finally {
      el.buyEggBtn.disabled = false;
      el.buyEggBtn.textContent = 'Buy';
    }
  });

  // Buy Chicken — pay directly via MetaMask
  el.buyChickenBtn?.addEventListener('click', async () => {
    const speciesId = parseInt(el.speciesSelect?.value, 10);
    if (!speciesId) return;

    el.buyChickenBtn.disabled = true;
    el.buyChickenBtn.textContent = 'Loading...';
    try {
      const selectedOpt = el.speciesSelect.options[el.speciesSelect.selectedIndex];
      const price = parseFloat(selectedOpt.dataset.price);

      el.buyChickenBtn.textContent = `Pay ${price.toFixed(2)} USDT...`;
      const txHash = await API.sendPayment(price);

      el.buyChickenBtn.textContent = 'Confirming...';
      toast('Transaction sent! Chicken will be added after blockchain confirmation.');

      await API.client.buyChicken(speciesId, txHash);
      loadFarm();
    } catch (e) {
      if (e.code === 4001) {
        toast('Transaction cancelled.', true);
      } else {
        toast(e.message, true);
      }
    } finally {
      el.buyChickenBtn.disabled = false;
      el.buyChickenBtn.textContent = 'Buy';
    }
  });

  el.withdrawBtn?.addEventListener('click', async () => {
    const amount = parseFloat(el.withdrawAmount?.value);
    if (!amount || amount <= 0) { toast('Enter a valid amount', true); return; }
    el.withdrawBtn.disabled = true;
    try {
      const r = await API.client.withdraw(amount);
      toast(`Withdrawal #${r.withdrawal_id} created — net ${r.net.toFixed(2)} USDT (fee ${r.fee.toFixed(2)})`);
      el.withdrawAmount.value = '';
      loadFarm();
    } catch (e) { toast(e.message, true); }
    el.withdrawBtn.disabled = false;
  });

  // ── Incubation & Chick Feeding ─────────────────
  const eggSelect = $('fertile-egg-select');
  const incubateBtn = $('incubate-btn');
  const chickFeedSelect = $('chick-feed-select');
  const chickFeedAmount = $('chick-feed-amount');
  const feedChickBtn = $('feed-chick-btn');
  const incubateAllBtn = $('incubate-all-btn');
  const feedAllChicksBtn = $('feed-all-chicks-btn');
  const deadChickensBody = $('dead-chickens-body');
  let countdownInterval = null;

  async function loadEggsForIncubation() {
    if (!eggSelect || !API.isLoggedIn()) return;
    try {
      const data = await API.client.eggsForIncubation();
      if (data.eggs.length === 0) {
        eggSelect.innerHTML = '<option disabled>No eggs available</option>';
      } else {
        eggSelect.innerHTML = data.eggs.map(e =>
          `<option value="${e.id}">Egg #${e.id} — ${new Date(e.produced_at).toLocaleDateString()}</option>`
        ).join('');
      }
    } catch (_) { /* ignore */ }
  }

  // Render incubating eggs with countdowns
  function renderIncubatingEggs() {
    const container = $('incubating-eggs-list');
    const badge = $('incubating-count');
    if (!container || !farmData) return;

    const eggs = farmData.incubating_eggs || [];
    const incHours = farmData.incubation_hours || 72;

    if (badge) badge.textContent = String(eggs.length);

    if (eggs.length === 0) {
      container.innerHTML = '<p class="text-soft">No eggs incubating at the moment.</p>';
      return;
    }

    container.innerHTML = '<div class="farm-items-grid">' + eggs.map(e => {
      const startMs = new Date(e.incubation_started_at).getTime();
      const endMs = startMs + incHours * 3600000;
      const progress = Math.min(100, ((Date.now() - startMs) / (incHours * 3600000)) * 100).toFixed(0);
      const isReady = Date.now() >= endMs;

      return `<div class="farm-item-card ${isReady ? 'ready' : ''}">
        <div class="farm-item-icon">&#x1F95A;</div>
        <div class="farm-item-body">
          <div class="farm-item-title">Egg #${e.id}</div>
          <div class="farm-item-meta">Incubating since ${new Date(e.incubation_started_at).toLocaleString()}</div>
          <div class="progress-bar-wrap">
            <div class="progress-bar" style="width:${progress}%"></div>
          </div>
          <div class="farm-item-countdown" data-end="${endMs}">
            ${isReady ? '<span class="status-pill ok">Ready to hatch!</span>' : `<span class="countdown-timer">${formatCountdown(endMs)}</span> remaining`}
          </div>
        </div>
      </div>`;
    }).join('') + '</div>';
  }

  // Render growing chicks with countdowns
  function renderGrowingChicks() {
    const container = $('growing-chicks-list');
    const badge = $('chicks-count');
    if (!container || !farmData) return;

    const chicks = farmData.chicks || [];
    const growthDays = farmData.chick_growth_days || 12;
    const feedNeeded = farmData.chick_feed_needed || 2.0;

    if (badge) badge.textContent = String(chicks.length);

    if (chicks.length === 0) {
      container.innerHTML = '<p class="text-soft">No chicks growing.</p>';
      return;
    }

    container.innerHTML = '<div class="farm-items-grid">' + chicks.map(c => {
      const hatchMs = new Date(c.hatched_at).getTime();
      const adultMs = hatchMs + growthDays * 86400000;
      const fedPct = Math.min(100, (parseFloat(c.feed_consumed) / feedNeeded) * 100).toFixed(0);
      const timeReady = Date.now() >= adultMs;
      const feedReady = parseFloat(c.feed_consumed) >= feedNeeded;
      const isReady = timeReady && feedReady;

      return `<div class="farm-item-card ${isReady ? 'ready' : ''}">
        <div class="farm-item-icon">&#x1F423;</div>
        <div class="farm-item-body">
          <div class="farm-item-title">Chick #${c.id} &rarr; ${c.target_species}</div>
          <div class="farm-item-meta">Hatched on ${new Date(c.hatched_at).toLocaleString()}</div>
          <div class="farm-item-stats">
            <span>Feed: ${parseFloat(c.feed_consumed).toFixed(1)}/${feedNeeded.toFixed(1)} (${fedPct}%)</span>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar ${feedReady ? 'complete' : ''}" style="width:${fedPct}%"></div>
          </div>
          <div class="farm-item-countdown" data-end="${adultMs}">
            ${timeReady
              ? (feedReady
                ? '<span class="status-pill ok">Ready to become adult!</span>'
                : '<span class="status-pill warn">Needs more feed</span>')
              : `<span class="countdown-timer">${formatCountdownDays(adultMs)}</span> to maturity`}
          </div>
        </div>
      </div>`;
    }).join('') + '</div>';
  }

  // Render hatch history
  function renderHatchHistory() {
    const body = $('hatch-history-body');
    const badge = $('hatch-history-count');
    if (!body || !farmData) return;

    const eggs = farmData.hatched_eggs || [];
    if (badge) badge.textContent = String(eggs.length);

    if (eggs.length === 0) {
      body.innerHTML = '<tr><td colspan="4" class="text-soft">No eggs hatched yet.</td></tr>';
      return;
    }

    body.innerHTML = eggs.slice(0, 20).map(e => {
      const isSuccess = e.status === 'hatched';
      return `<tr>
        <td>#${e.id}</td>
        <td>${e.incubation_started_at ? new Date(e.incubation_started_at).toLocaleString() : '--'}</td>
        <td>${e.hatched_at ? new Date(e.hatched_at).toLocaleString() : '--'}</td>
        <td><span class="status-pill ${isSuccess ? 'ok' : 'danger'}">${isSuccess ? 'Success' : 'Failed'}</span></td>
      </tr>`;
    }).join('');

    // If more than 20, show load more
    const pagination = $('hatch-history-pagination');
    if (pagination && eggs.length >= 20) {
      pagination.innerHTML = '<button class="btn btn-ghost btn-sm" id="load-more-hatch">Load more</button>';
      $('load-more-hatch')?.addEventListener('click', () => loadEggHistory(2));
    }
  }

  let eggHistoryPage = 1;
  async function loadEggHistory(page) {
    const body = $('hatch-history-body');
    if (!body) return;
    try {
      const data = await API.client.eggHistory(page);
      if (data.eggs.length === 0) return;

      const newRows = data.eggs.map(e => {
        const isSuccess = e.status === 'hatched';
        return `<tr>
          <td>#${e.id}</td>
          <td>${e.incubation_started_at ? new Date(e.incubation_started_at).toLocaleString() : '--'}</td>
          <td>${e.hatched_at ? new Date(e.hatched_at).toLocaleString() : '--'}</td>
          <td><span class="status-pill ${isSuccess ? 'ok' : 'danger'}">${isSuccess ? 'Success' : 'Failed'}</span></td>
        </tr>`;
      }).join('');

      body.insertAdjacentHTML('beforeend', newRows);
      eggHistoryPage = page;

      const pagination = $('hatch-history-pagination');
      if (pagination) {
        if (data.eggs.length < data.limit || page * data.limit >= data.total) {
          pagination.innerHTML = '';
        } else {
          pagination.innerHTML = '<button class="btn btn-ghost btn-sm" id="load-more-hatch">Load more</button>';
          $('load-more-hatch')?.addEventListener('click', () => loadEggHistory(page + 1));
        }
      }
    } catch (_) { /* ignore */ }
  }

  // Chick history (promoted to adult)
  let chickHistoryPage = 1;
  async function loadChickHistory() {
    const body = $('chick-history-body');
    if (!body || !API.isLoggedIn()) return;
    try {
      const data = await API.client.chickHistory(1);
      if (data.chicks.length === 0) {
        body.innerHTML = '<tr><td colspan="5" class="text-soft">No chicks promoted yet.</td></tr>';
      } else {
        body.innerHTML = data.chicks.map(c => `
          <tr>
            <td>#${c.id}</td>
            <td>${esc(c.species)}</td>
            <td>${new Date(c.hatched_at).toLocaleString()}</td>
            <td>${c.adult_at ? new Date(c.adult_at).toLocaleString() : '--'}</td>
            <td>${parseFloat(c.feed_consumed).toFixed(1)}</td>
          </tr>
        `).join('');

        const pagination = $('chick-history-pagination');
        if (pagination && data.total > data.limit) {
          pagination.innerHTML = '<button class="btn btn-ghost btn-sm" id="load-more-chick-hist">Load more</button>';
          $('load-more-chick-hist')?.addEventListener('click', () => loadMoreChickHistory(2));
        }
      }
    } catch (_) { /* ignore */ }
  }

  async function loadMoreChickHistory(page) {
    const body = $('chick-history-body');
    if (!body) return;
    try {
      const data = await API.client.chickHistory(page);
      if (data.chicks.length === 0) return;

      body.insertAdjacentHTML('beforeend', data.chicks.map(c => `
        <tr>
          <td>#${c.id}</td>
          <td>${esc(c.species)}</td>
          <td>${new Date(c.hatched_at).toLocaleString()}</td>
          <td>${c.adult_at ? new Date(c.adult_at).toLocaleString() : '--'}</td>
          <td>${parseFloat(c.feed_consumed).toFixed(1)}</td>
        </tr>
      `).join(''));

      const pagination = $('chick-history-pagination');
      if (pagination) {
        if (data.chicks.length < data.limit || page * data.limit >= data.total) {
          pagination.innerHTML = '';
        } else {
          pagination.innerHTML = '<button class="btn btn-ghost btn-sm" id="load-more-chick-hist">Load more</button>';
          $('load-more-chick-hist')?.addEventListener('click', () => loadMoreChickHistory(page + 1));
        }
      }
    } catch (_) { /* ignore */ }
  }

  // Start countdown ticker
  function startCountdownTicker() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      document.querySelectorAll('.farm-item-countdown[data-end]').forEach(el => {
        const endMs = parseInt(el.dataset.end, 10);
        if (isNaN(endMs)) return;
        const timer = el.querySelector('.countdown-timer');
        if (timer) {
          if (Date.now() >= endMs) {
            el.innerHTML = '<span class="status-pill ok">Ready!</span>';
          } else {
            // Decide format based on time remaining
            const diff = endMs - Date.now();
            timer.textContent = diff > 86400000 ? formatCountdownDays(endMs) : formatCountdown(endMs);
          }
        }
      });
    }, 1000);
  }

  incubateBtn?.addEventListener('click', async () => {
    const eggId = parseInt(eggSelect?.value, 10);
    if (!eggId) { toast('Select an egg to incubate', true); return; }
    incubateBtn.disabled = true;
    try {
      const r = await API.client.incubateEgg(eggId);
      toast(`Egg #${r.egg_id} is incubating (feed used: ${r.feed_consumed})`);
      loadFarm();
    } catch (e) { toast(e.message, true); }
    incubateBtn.disabled = false;
  });

  function loadChickFeedSelect() {
    if (!chickFeedSelect || !farmData) return;
    if (farmData.chicks.length === 0) {
      chickFeedSelect.innerHTML = '<option disabled>No chicks</option>';
    } else {
      chickFeedSelect.innerHTML = farmData.chicks.map(c =>
        `<option value="${c.id}">Chick #${c.id} → ${c.target_species} (${parseFloat(c.feed_consumed).toFixed(1)}/${(farmData.chick_feed_needed || 2.0).toFixed(1)})</option>`
      ).join('');
    }
  }

  feedChickBtn?.addEventListener('click', async () => {
    const chickId = parseInt(chickFeedSelect?.value, 10);
    const amount = parseFloat(chickFeedAmount?.value || '0.5');
    if (!chickId) { toast('Select a chick', true); return; }
    feedChickBtn.disabled = true;
    try {
      const r = await API.client.feedChick(chickId, amount);
      toast(`Chick #${r.chick_id} fed: ${r.fed} (${r.progress} complete)`);
      loadFarm();
    } catch (e) { toast(e.message, true); }
    feedChickBtn.disabled = false;
  });

  incubateAllBtn?.addEventListener('click', async () => {
    incubateAllBtn.disabled = true;
    try {
      const r = await API.client.incubateAll();
      toast(`${r.incubated} egg(s) incubating! Feed used: ${r.feed_consumed}`);
      loadFarm();
    } catch (e) { toast(e.message, true); }
    incubateAllBtn.disabled = false;
  });

  feedAllChicksBtn?.addEventListener('click', async () => {
    feedAllChicksBtn.disabled = true;
    try {
      const r = await API.client.feedAllChicks();
      toast(`${r.chicks_fed} chick(s) fed! Feed used: ${r.total_feed_used}`);
      loadFarm();
    } catch (e) { toast(e.message, true); }
    feedAllChicksBtn.disabled = false;
  });

  async function loadDeadChickens() {
    if (!deadChickensBody || !API.isLoggedIn()) return;
    try {
      const { chickens } = await API.client.deadChickens(1);
      if (chickens.length === 0) {
        deadChickensBody.innerHTML = '<tr><td colspan="7" class="text-soft">No deceased chickens.</td></tr>';
      } else {
        deadChickensBody.innerHTML = chickens.map(c => {
          const causeLabel = c.death_cause === 'starvation' ? 'Starvation' : c.death_cause === 'lifespan' ? 'Lifespan' : c.death_cause || 'Unknown';
          const causeClass = c.death_cause === 'starvation' ? 'danger' : 'warn';
          const displayName = c.name || c.species;
          return `<tr>
            <td>${esc(displayName)}</td>
            <td>${esc(c.species)}</td>
            <td>${parseInt(c.total_eggs_produced || 0, 10)}</td>
            <td>${parseFloat(c.total_feed_consumed || 0).toFixed(1)}</td>
            <td>${new Date(c.born_at).toLocaleDateString()}</td>
            <td>${c.died_at ? new Date(c.died_at).toLocaleDateString() : ''}</td>
            <td><span class="status-pill ${causeClass}">${causeLabel}</span></td>
          </tr>`;
        }).join('');
      }
    } catch (_) { /* ignore */ }
  }

  // ── Rename Chicken (global handler) ───────────
  window.__renameChicken = async function(id) {
    const nameEl = document.getElementById('cname-' + id);
    if (!nameEl) return;
    const currentName = nameEl.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'chicken-name-input';
    input.value = currentName;
    input.maxLength = 30;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    async function save() {
      const newName = input.value.trim();
      if (newName && newName !== currentName) {
        try {
          await API.client.renameChicken(id, newName);
          toast('Chicken renamed!');
        } catch (e) { toast(e.message, true); }
      }
      loadFarm();
    }

    input.addEventListener('blur', save, { once: true });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = currentName; input.blur(); }
    });
  };

  // ── Auto-refresh ───────────────────────────────
  if (API.isLoggedIn()) {
    loadFarm();
    startCountdownTicker();
    setInterval(loadFarm, 30000);
  }
})();
