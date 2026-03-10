(function () {
  const page = document.body.dataset.page;

  // ── Helpers ────────────────────────────────────────
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

  // ── Auth Bar (shared) ─────────────────────────────
  const connectBtn = $('connect-btn');
  const authInfo = $('auth-info');
  const walletLabel = $('wallet-label');
  const logoutBtn = $('logout-btn');

  function updateAuthUI() {
    if (API.isLoggedIn()) {
      if (connectBtn) hide(connectBtn);
      if (authInfo) show(authInfo);
      if (walletLabel) walletLabel.textContent = shortWallet(API.getUser()?.wallet_address);
    } else {
      if (connectBtn) show(connectBtn);
      if (authInfo) hide(authInfo);
    }
  }

  connectBtn?.addEventListener('click', async () => {
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';
    try {
      await API.connectMetaMask();
      updateAuthUI();
      toast('Connected successfully!');
      if (page === 'client') loadFarm();
      if (page === 'admin') loadAdmin();
    } catch (e) {
      toast(e.message, true);
    } finally {
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect MetaMask';
    }
  });

  logoutBtn?.addEventListener('click', () => {
    API.logout();
    updateAuthUI();
    location.reload();
  });

  updateAuthUI();

  // ═══════════════════════════════════════════════════
  // CLIENT PAGE
  // ═══════════════════════════════════════════════════
  if (page === 'client') {
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

    let farmData = null;

    function renderFarm() {
      if (!farmData) return;
      el.chickens.textContent = String(farmData.chickens.length);
      el.eggs.textContent = String(farmData.eggs_available);
      el.feed.textContent = `${farmData.feed_balance.toFixed(1)} units`;
      el.wallet.textContent = `${farmData.balance_usdt.toFixed(2)} USDT`;
      el.autoBtn.textContent = farmData.auto_feed_enabled ? 'Disable Auto Feed' : 'Enable Auto Feed';

      if (farmData.feed_balance <= 3) {
        el.farmStatus.textContent = 'Warning: feed is critically low. Chickens stop producing without feed.';
        el.farmStatus.classList.add('warning');
      } else {
        el.farmStatus.textContent = 'Farm is stable. Production is running normally.';
        el.farmStatus.classList.remove('warning');
      }

      // Chicken list
      if (el.chickenList) {
        if (farmData.chickens.length === 0) {
          el.chickenList.innerHTML = '<p class="text-soft">No active chickens.</p>';
        } else {
          el.chickenList.innerHTML = farmData.chickens.map(c => {
            const starving = c.starvation_started_at ? ' <span class="status-pill danger">Starving</span>' : '';
            return `<div class="chicken-row"><strong>${c.species}</strong>${starving}<span class="text-soft"> — dies ${new Date(c.dies_at).toLocaleDateString()}</span></div>`;
          }).join('');
        }
      }
    }

    async function loadFarm() {
      if (!API.isLoggedIn()) return;
      try {
        farmData = await API.client.farm();
        renderFarm();
        loadSpecies();
        loadLedger();
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

    // Actions
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

    // Auto-refresh every 30s
    if (API.isLoggedIn()) {
      loadFarm();
      setInterval(loadFarm, 30000);
    }
  }

  // ═══════════════════════════════════════════════════
  // ADMIN PAGE
  // ═══════════════════════════════════════════════════
  if (page === 'admin') {
    const alertBadge = $('p1-count');
    const regStatus = $('registrations-status');
    const regToggle = $('registrations-toggle');
    const economyForm = $('economy-form');
    const withdrawalBody = $('withdrawal-body');
    const userBody = $('user-body');

    async function loadAdmin() {
      if (!API.isLoggedIn() || !API.isAdmin()) return;
      await Promise.all([loadAlerts(), loadEconomy(), loadWithdrawals(), loadUsers()]);
    }

    async function loadAlerts() {
      try {
        const data = await API.admin.getAlerts();
        if (alertBadge) alertBadge.textContent = String(data.p1.starvation_risk + data.p1.withdrawal_sla_breach);
      } catch (_) { /* ignore */ }
    }

    async function loadEconomy() {
      try {
        const configs = await API.admin.getEconomy();
        if (economyForm) {
          const editableKeys = [
            { key: 'egg_system_price', label: 'Egg System Price (USDT)', type: 'number' },
            { key: 'feed_unit_price', label: 'Feed Unit Price (USDT)', type: 'number' },
            { key: 'withdrawal_fee_rate', label: 'Withdrawal Fee Rate', type: 'number' },
            { key: 'withdrawal_min_amount', label: 'Min Withdrawal (USDT)', type: 'number' },
            { key: 'starvation_death_hours', label: 'Starvation Death (hours)', type: 'number' },
            { key: 'onboarding_free_feed', label: 'Onboarding Free Feed', type: 'number' },
            { key: 'allow_new_registrations', label: 'Allow New Registrations', type: 'toggle' },
          ];

          economyForm.innerHTML = editableKeys.map(({ key, label, type }) => {
            const val = configs[key] || '';
            if (type === 'toggle') {
              return `<div class="config-row">
                <label>${label}</label>
                <button class="btn btn-ghost config-toggle" data-key="${key}" data-val="${val}">${val === 'true' ? 'Open' : 'Blocked'}</button>
              </div>`;
            }
            return `<div class="config-row">
              <label>${label}</label>
              <input class="input" type="number" step="any" data-key="${key}" value="${val}" />
              <button class="btn btn-ghost config-save" data-key="${key}">Save</button>
            </div>`;
          }).join('');

          // Bind save buttons
          economyForm.querySelectorAll('.config-save').forEach(btn => {
            btn.addEventListener('click', async () => {
              const key = btn.dataset.key;
              const input = economyForm.querySelector(`input[data-key="${key}"]`);
              try {
                await API.admin.setEconomy(key, input.value);
                toast(`${key} updated`);
              } catch (e) { toast(e.message, true); }
            });
          });

          // Bind toggle buttons
          economyForm.querySelectorAll('.config-toggle').forEach(btn => {
            btn.addEventListener('click', async () => {
              const key = btn.dataset.key;
              const newVal = btn.dataset.val === 'true' ? 'false' : 'true';
              try {
                await API.admin.setEconomy(key, newVal);
                btn.dataset.val = newVal;
                btn.textContent = newVal === 'true' ? 'Open' : 'Blocked';
                toast(`${key} = ${newVal}`);
              } catch (e) { toast(e.message, true); }
            });
          });
        }

        // Update registration pill
        if (regStatus) {
          const open = configs.allow_new_registrations === 'true';
          regStatus.textContent = open ? 'Open' : 'Blocked';
          regStatus.className = `status-pill ${open ? 'ok' : 'danger'}`;
        }
      } catch (e) { toast(e.message, true); }
    }

    // Legacy toggle (still in HTML)
    regToggle?.addEventListener('click', async () => {
      const current = regStatus?.textContent === 'Open';
      try {
        await API.admin.setEconomy('allow_new_registrations', current ? 'false' : 'true');
        regStatus.textContent = current ? 'Blocked' : 'Open';
        regStatus.className = `status-pill ${current ? 'danger' : 'ok'}`;
        regToggle.textContent = current ? 'Enable New Users' : 'Block New Users';
        toast(`Registrations ${current ? 'blocked' : 'opened'}`);
      } catch (e) { toast(e.message, true); }
    });

    async function loadWithdrawals() {
      if (!withdrawalBody) return;
      try {
        const data = await API.admin.getWithdrawals('pending');
        if (data.withdrawals.length === 0) {
          withdrawalBody.innerHTML = '<tr><td colspan="5" class="text-soft">No pending withdrawals.</td></tr>';
        } else {
          withdrawalBody.innerHTML = data.withdrawals.map(w => `
            <tr>
              <td>#${w.id}</td>
              <td title="${w.wallet_address}">${shortWallet(w.wallet_address)}</td>
              <td>${parseFloat(w.net_amount).toFixed(2)} USDT</td>
              <td>${new Date(w.created_at).toLocaleString()}</td>
              <td>
                <button class="btn btn-primary btn-sm wd-process" data-id="${w.id}">Process</button>
                <button class="btn btn-ghost btn-sm wd-reject" data-id="${w.id}">Reject</button>
              </td>
            </tr>
          `).join('');

          withdrawalBody.querySelectorAll('.wd-process').forEach(btn => {
            btn.addEventListener('click', async () => {
              try {
                const r = await API.admin.processWithdrawal(btn.dataset.id);
                toast(`Withdrawal #${r.withdrawal_id} processing — pay ${parseFloat(r.net_amount).toFixed(2)} to ${shortWallet(r.pay_to)}`);
                const txHash = prompt('Enter TX hash after sending payment:');
                if (txHash) {
                  await API.admin.completeWithdrawal(btn.dataset.id, txHash);
                  toast(`Withdrawal #${r.withdrawal_id} completed`);
                }
                loadWithdrawals();
              } catch (e) { toast(e.message, true); }
            });
          });

          withdrawalBody.querySelectorAll('.wd-reject').forEach(btn => {
            btn.addEventListener('click', async () => {
              const note = prompt('Rejection reason (optional):');
              try {
                await API.admin.rejectWithdrawal(btn.dataset.id, note || '');
                toast(`Withdrawal #${btn.dataset.id} rejected and refunded`);
                loadWithdrawals();
              } catch (e) { toast(e.message, true); }
            });
          });
        }
      } catch (e) { toast(e.message, true); }
    }

    async function loadUsers() {
      if (!userBody) return;
      try {
        const data = await API.admin.getUsers(1);
        if (data.users.length === 0) {
          userBody.innerHTML = '<tr><td colspan="5" class="text-soft">No users yet.</td></tr>';
        } else {
          userBody.innerHTML = data.users.map(u => `
            <tr>
              <td title="${u.wallet_address}">${shortWallet(u.wallet_address)}</td>
              <td>${parseFloat(u.balance_usdt).toFixed(2)}</td>
              <td>${parseFloat(u.feed_balance).toFixed(1)}</td>
              <td>${u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}</td>
              <td>
                <button class="btn btn-ghost btn-sm user-ban" data-id="${u.id}" data-banned="${u.is_banned}">
                  ${u.is_banned ? 'Unban' : 'Ban'}
                </button>
              </td>
            </tr>
          `).join('');

          userBody.querySelectorAll('.user-ban').forEach(btn => {
            btn.addEventListener('click', async () => {
              const newBanned = btn.dataset.banned !== 'true';
              try {
                await API.admin.banUser(btn.dataset.id, newBanned);
                toast(`User ${newBanned ? 'banned' : 'unbanned'}`);
                loadUsers();
              } catch (e) { toast(e.message, true); }
            });
          });
        }
      } catch (e) { toast(e.message, true); }
    }

    if (API.isLoggedIn() && API.isAdmin()) {
      loadAdmin();
      setInterval(loadAdmin, 60000);
    }
  }
})();
