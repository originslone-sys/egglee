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
      loadDepositAddress();
      loadDeposits();
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
        `<option value="${s.id}">${s.name} — ${parseFloat(s.purchase_price).toFixed(2)} USDT (${parseFloat(s.eggs_per_day)} eggs/day)</option>`
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

  el.feedBtn?.addEventListener('click', async () => {
    el.feedBtn.disabled = true;
    try {
      const r = await API.client.buyFeed(10);
      toast(`Bought 10 feed for ${r.cost.toFixed(2)} USDT`);
      loadFarm();
    } catch (e) { toast(e.message, true); }
    el.feedBtn.disabled = false;
  });

  el.autoBtn?.addEventListener('click', async () => {
    try {
      const r = await API.client.toggleAutoFeed();
      if (farmData) farmData.auto_feed_enabled = r.auto_feed_enabled;
      renderFarm();
      toast(`Auto feed ${r.auto_feed_enabled ? 'enabled' : 'disabled'}`);
    } catch (e) { toast(e.message, true); }
  });

  el.buyChickenBtn?.addEventListener('click', async () => {
    const speciesId = parseInt(el.speciesSelect?.value, 10);
    if (!speciesId) return;
    el.buyChickenBtn.disabled = true;
    try {
      const r = await API.client.buyChicken(speciesId);
      toast(`Bought ${r.species} chicken!`);
      loadFarm();
    } catch (e) { toast(e.message, true); }
    el.buyChickenBtn.disabled = false;
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

  // ── Deposits ───────────────────────────────────
  const depositAddr = $('deposit-addr');
  const copyAddrBtn = $('copy-addr-btn');
  const depositsBody = $('deposits-body');

  async function loadDepositAddress() {
    if (!depositAddr || !API.isLoggedIn()) return;
    try {
      const data = await API.client.depositAddress();
      depositAddr.textContent = data.wallet_address;
    } catch (_) { /* ignore */ }
  }

  copyAddrBtn?.addEventListener('click', () => {
    const addr = depositAddr?.textContent;
    if (addr && addr !== 'Connect to see address') {
      navigator.clipboard.writeText(addr).then(() => toast('Address copied!'));
    }
  });

  async function loadDeposits() {
    if (!depositsBody || !API.isLoggedIn()) return;
    try {
      const { deposits } = await API.client.deposits(1);
      if (deposits.length === 0) {
        depositsBody.innerHTML = '<tr><td colspan="4" class="text-soft">No deposits yet.</td></tr>';
      } else {
        depositsBody.innerHTML = deposits.slice(0, 10).map(d => {
          const statusClass = d.status === 'confirmed' ? 'ok' : d.status === 'failed' ? 'danger' : 'warn';
          const txShort = d.tx_hash ? d.tx_hash.slice(0, 10) + '...' : '';
          return `<tr>
            <td>${new Date(d.created_at).toLocaleString()}</td>
            <td>${parseFloat(d.amount).toFixed(2)} USDT</td>
            <td><span class="status-pill ${statusClass}">${d.status} (${d.confirmations} conf)</span></td>
            <td title="${d.tx_hash || ''}">${txShort}</td>
          </tr>`;
        }).join('');
      }
    } catch (_) { /* ignore */ }
  }

  // ── P2P Marketplace ────────────────────────────
  const mktTabs = {
    browse: { btn: $('tab-browse'), panel: $('panel-browse') },
    sell: { btn: $('tab-sell'), panel: $('panel-sell') },
    myOrders: { btn: $('tab-my-orders'), panel: $('panel-my-orders') },
  };
  const myFeeLabel = $('my-fee');
  const listingsBody = $('listings-body');
  const listingsPag = $('listings-pagination');
  const marketType = $('market-type');
  const marketSort = $('market-sort');
  const marketRefresh = $('market-refresh');
  const sellEggBtn = $('sell-egg-btn');
  const sellChickenBtn = $('sell-chicken-btn');
  const sellChickenSelect = $('sell-chicken-select');
  const mySellingBody = $('my-selling-body');
  const myBoughtBody = $('my-bought-body');

  let marketPage = 1;

  function switchMarketTab(name) {
    Object.entries(mktTabs).forEach(([key, { btn, panel }]) => {
      if (!btn) return;
      if (key === name) {
        btn.classList.add('active');
        if (panel) panel.style.display = '';
      } else {
        btn.classList.remove('active');
        if (panel) panel.style.display = 'none';
      }
    });
    if (name === 'browse') loadListings();
    if (name === 'sell') populateSellChickens();
    if (name === 'myOrders') loadMyOrders();
  }

  mktTabs.browse.btn?.addEventListener('click', () => switchMarketTab('browse'));
  mktTabs.sell.btn?.addEventListener('click', () => switchMarketTab('sell'));
  mktTabs.myOrders.btn?.addEventListener('click', () => switchMarketTab('myOrders'));

  marketType?.addEventListener('change', () => { marketPage = 1; loadListings(); });
  marketSort?.addEventListener('change', () => { marketPage = 1; loadListings(); });
  marketRefresh?.addEventListener('click', () => loadListings());

  async function loadMyFee() {
    if (!myFeeLabel) return;
    try {
      const { fee_percent } = await API.marketplace.myFee();
      myFeeLabel.textContent = `Fee: ${fee_percent}`;
    } catch (_) { /* ignore */ }
  }

  async function loadListings() {
    if (!listingsBody || !API.isLoggedIn()) return;
    try {
      const type = marketType?.value || 'egg';
      const sort = marketSort?.value || 'price_asc';
      const data = await API.marketplace.listings(type, marketPage, sort);

      if (data.listings.length === 0) {
        listingsBody.innerHTML = `<tr><td colspan="5" class="text-soft">No ${type} listings available.</td></tr>`;
      } else {
        listingsBody.innerHTML = data.listings.map(l => {
          const itemLabel = l.item_type === 'chicken' && l.species_name ? `${l.species_name} Chicken` : 'Egg';
          return `<tr>
            <td>${itemLabel}</td>
            <td title="${l.seller_wallet}">${shortWallet(l.seller_wallet)}</td>
            <td>${parseFloat(l.price).toFixed(2)} USDT</td>
            <td>${new Date(l.created_at).toLocaleDateString()}</td>
            <td><button class="btn btn-primary btn-sm p2p-buy" data-id="${l.id}">Buy</button></td>
          </tr>`;
        }).join('');

        listingsBody.querySelectorAll('.p2p-buy').forEach(btn => {
          btn.addEventListener('click', async () => {
            btn.disabled = true;
            try {
              const r = await API.marketplace.buy(btn.dataset.id);
              toast(`Bought ${r.item_type} for ${r.price.toFixed(2)} USDT (fee ${r.fee.toFixed(2)})`);
              loadListings();
              loadFarm();
            } catch (e) { toast(e.message, true); }
            btn.disabled = false;
          });
        });
      }

      if (listingsPag) {
        const totalPages = Math.ceil(data.total / data.limit);
        listingsPag.innerHTML = totalPages > 1
          ? Array.from({ length: totalPages }, (_, i) =>
              `<button class="btn ${i + 1 === marketPage ? 'btn-primary' : 'btn-ghost'} btn-sm pag-btn" data-p="${i + 1}">${i + 1}</button>`
            ).join('')
          : '';
        listingsPag.querySelectorAll('.pag-btn').forEach(btn => {
          btn.addEventListener('click', () => { marketPage = parseInt(btn.dataset.p, 10); loadListings(); });
        });
      }
    } catch (e) { toast(e.message, true); }
  }

  function populateSellChickens() {
    if (!sellChickenSelect || !farmData) return;
    sellChickenSelect.innerHTML = farmData.chickens.map(c =>
      `<option value="${c.id}">${c.species} #${c.id}</option>`
    ).join('');
    if (farmData.chickens.length === 0) {
      sellChickenSelect.innerHTML = '<option disabled>No chickens available</option>';
    }
  }

  sellEggBtn?.addEventListener('click', async () => {
    const price = parseFloat($('sell-egg-price')?.value);
    const qty = parseInt($('sell-egg-qty')?.value || '1', 10);
    if (!price || price <= 0) { toast('Enter a valid price', true); return; }
    sellEggBtn.disabled = true;
    try {
      const r = await API.marketplace.listEgg(price, qty);
      toast(`Listed ${r.listed} egg(s) at ${price.toFixed(2)} USDT each (fee ${(r.fee_rate * 100).toFixed(1)}%)`);
      $('sell-egg-price').value = '';
      loadFarm();
    } catch (e) { toast(e.message, true); }
    sellEggBtn.disabled = false;
  });

  sellChickenBtn?.addEventListener('click', async () => {
    const chickenId = parseInt(sellChickenSelect?.value, 10);
    const price = parseFloat($('sell-chicken-price')?.value);
    if (!chickenId || !price || price <= 0) { toast('Select a chicken and enter a valid price', true); return; }
    sellChickenBtn.disabled = true;
    try {
      const r = await API.marketplace.listChicken(chickenId, price);
      toast(`Chicken listed for ${price.toFixed(2)} USDT (fee ${(r.fee_rate * 100).toFixed(1)}%)`);
      $('sell-chicken-price').value = '';
      loadFarm();
    } catch (e) { toast(e.message, true); }
    sellChickenBtn.disabled = false;
  });

  async function loadMyOrders() {
    if (!mySellingBody || !API.isLoggedIn()) return;
    try {
      const data = await API.marketplace.myOrders();

      const active = data.selling.filter(o => o.status === 'listed');
      if (active.length === 0) {
        mySellingBody.innerHTML = '<tr><td colspan="5" class="text-soft">No active listings.</td></tr>';
      } else {
        mySellingBody.innerHTML = active.map(o => `
          <tr>
            <td>#${o.id}</td>
            <td>${o.item_type}</td>
            <td>${parseFloat(o.price).toFixed(2)} USDT</td>
            <td><span class="status-pill ok">Listed</span></td>
            <td><button class="btn btn-ghost btn-sm p2p-cancel" data-id="${o.id}">Cancel</button></td>
          </tr>
        `).join('');

        mySellingBody.querySelectorAll('.p2p-cancel').forEach(btn => {
          btn.addEventListener('click', async () => {
            try {
              await API.marketplace.cancel(btn.dataset.id);
              toast('Listing cancelled');
              loadMyOrders();
              loadFarm();
            } catch (e) { toast(e.message, true); }
          });
        });
      }

      if (data.bought.length === 0) {
        myBoughtBody.innerHTML = '<tr><td colspan="4" class="text-soft">No purchases yet.</td></tr>';
      } else {
        myBoughtBody.innerHTML = data.bought.map(o => `
          <tr>
            <td>#${o.id}</td>
            <td>${o.item_type}</td>
            <td>${parseFloat(o.price).toFixed(2)} USDT</td>
            <td>${new Date(o.sold_at).toLocaleDateString()}</td>
          </tr>
        `).join('');
      }
    } catch (e) { toast(e.message, true); }
  }

  // ── Auto-refresh ───────────────────────────────
  if (API.isLoggedIn()) {
    loadFarm();
    loadMyFee();
    loadListings();
    setInterval(loadFarm, 30000);
  }
})();
