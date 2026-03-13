/**
 * client.js — Client Dashboard Controller for Galinha Farm
 */
(function () {
  // ── Helpers ─────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function show(el) { if (el) el.style.display = ''; }
  function hide(el) { if (el) el.style.display = 'none'; }

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
    autoBtn: $('auto-feed-btn'),
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
        entityDetails.innerHTML = `
          <div class="entity-details-grid">
            <div class="entity-detail"><span class="detail-label">Species</span><span class="detail-value">${c.species}</span></div>
            <div class="entity-detail"><span class="detail-label">ID</span><span class="detail-value">#${c.id}</span></div>
            <div class="entity-detail"><span class="detail-label">Status</span><span class="detail-value">${status}</span></div>
            <div class="entity-detail"><span class="detail-label">Days Left</span><span class="detail-value">${daysLeft}d</span></div>
            <div class="entity-detail"><span class="detail-label">Born</span><span class="detail-value">${new Date(c.born_at).toLocaleDateString()}</span></div>
          </div>`;
      } else if (entity.type === 'chick') {
        const c = entity.data;
        const feedPct = Math.min(100, ((parseFloat(c.feed_consumed) / 2.0) * 100)).toFixed(0);
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
    if (el.autoBtn) el.autoBtn.textContent = farmData.auto_feed_enabled ? 'Disable' : 'Enable';

    // Status banner
    if (el.farmStatus) {
      if (farmData.feed_balance <= 0) {
        el.farmStatus.textContent = 'Ração esgotada: sem alimentação as galinhas podem morrer.';
        el.farmStatus.className = 'farm-status-banner warning';
      } else if (farmData.feed_balance <= 3) {
        el.farmStatus.textContent = 'Ração baixa! Compre mais ração para manter a produção.';
        el.farmStatus.className = 'farm-status-banner warning';
      } else {
        el.farmStatus.textContent = 'Fazenda estável. Produção funcionando normalmente.';
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
          return `<div class="chicken-item">
            <div class="chicken-avatar" style="background:${bg}">&#x1f414;</div>
            <div class="chicken-info">
              <div class="chicken-name">${c.species} ${starving ? '<span class="status-pill danger">Starving</span>' : ''}</div>
              <div class="chicken-meta">${daysLeft}d left</div>
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
      loadFertileEggs();
      loadChickFeedSelect();
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
          const typeLabel = p.purchase_type === 'feed' ? 'Ração' : 'Galinha';
          return `<tr>
            <td>${new Date(p.created_at).toLocaleString()}</td>
            <td>${typeLabel}</td>
            <td>${parseFloat(p.expected_amount).toFixed(2)} USDT</td>
            <td><span class="status-pill ${statusClass}">${p.status}</span></td>
            <td title="${p.tx_hash || ''}">${txShort}</td>
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

  el.autoBtn?.addEventListener('click', async () => {
    try {
      const r = await API.client.toggleAutoFeed();
      if (farmData) farmData.auto_feed_enabled = r.auto_feed_enabled;
      renderFarm();
      toast(`Auto feed ${r.auto_feed_enabled ? 'enabled' : 'disabled'}`);
    } catch (e) { toast(e.message, true); }
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
  const fertileEggSelect = $('fertile-egg-select');
  const incubateBtn = $('incubate-btn');
  const incubatingList = $('incubating-list');
  const chickFeedSelect = $('chick-feed-select');
  const chickFeedAmount = $('chick-feed-amount');
  const feedChickBtn = $('feed-chick-btn');
  const deadChickensBody = $('dead-chickens-body');

  async function loadFertileEggs() {
    if (!fertileEggSelect || !API.isLoggedIn()) return;
    try {
      const data = await API.client.fertileEggs();
      if (data.fertile.length === 0) {
        fertileEggSelect.innerHTML = '<option disabled>No fertile eggs</option>';
      } else {
        fertileEggSelect.innerHTML = data.fertile.map(e =>
          `<option value="${e.id}">Egg #${e.id} — ${new Date(e.produced_at).toLocaleDateString()}</option>`
        ).join('');
      }
      if (incubatingList) {
        incubatingList.innerHTML = data.incubating.length > 0
          ? data.incubating.map(e =>
              `<span class="status-pill warn" style="margin:.2rem">Egg #${e.id} incubating</span>`
            ).join('')
          : '';
      }
    } catch (_) { /* ignore */ }
  }

  incubateBtn?.addEventListener('click', async () => {
    const eggId = parseInt(fertileEggSelect?.value, 10);
    if (!eggId) { toast('Select a fertile egg', true); return; }
    incubateBtn.disabled = true;
    try {
      const r = await API.client.incubateEgg(eggId);
      toast(`Egg #${r.egg_id} is now incubating (feed used: ${r.feed_consumed})`);
      loadFarm();
    } catch (e) { toast(e.message, true); }
    incubateBtn.disabled = false;
  });

  function loadChickFeedSelect() {
    if (!chickFeedSelect || !farmData) return;
    if (farmData.chicks.length === 0) {
      chickFeedSelect.innerHTML = '<option disabled>No growing chicks</option>';
    } else {
      chickFeedSelect.innerHTML = farmData.chicks.map(c =>
        `<option value="${c.id}">Chick #${c.id} → ${c.target_species} (fed: ${parseFloat(c.feed_consumed).toFixed(1)}/2.0)</option>`
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
      toast(`Fed chick #${r.chick_id}: ${r.fed} units (${r.progress} complete)`);
      loadFarm();
    } catch (e) { toast(e.message, true); }
    feedChickBtn.disabled = false;
  });

  async function loadDeadChickens() {
    if (!deadChickensBody || !API.isLoggedIn()) return;
    try {
      const { chickens } = await API.client.deadChickens(1);
      if (chickens.length === 0) {
        deadChickensBody.innerHTML = '<tr><td colspan="5" class="text-soft">No deceased chickens.</td></tr>';
      } else {
        deadChickensBody.innerHTML = chickens.map(c => {
          const causeClass = c.death_cause === 'starvation' ? 'danger' : 'warn';
          return `<tr>
            <td>#${c.id}</td>
            <td>${c.species}</td>
            <td>${new Date(c.born_at).toLocaleDateString()}</td>
            <td>${c.died_at ? new Date(c.died_at).toLocaleDateString() : ''}</td>
            <td><span class="status-pill ${causeClass}">${c.death_cause || 'unknown'}</span></td>
          </tr>`;
        }).join('');
      }
    } catch (_) { /* ignore */ }
  }

  // ── Auto-refresh ───────────────────────────────
  if (API.isLoggedIn()) {
    loadFarm();
    setInterval(loadFarm, 30000);
  }
})();
