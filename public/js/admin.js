/**
 * admin.js — Admin Panel Controller for Egglee
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

  function fmtUSDT(v) { return (parseFloat(v) || 0).toFixed(2) + ' USDT'; }

  // Poll eth_getTransactionReceipt until the TX is mined (max ~2 min)
  async function waitForTxReceipt(txHash, maxAttempts = 40) {
    for (let i = 0; i < maxAttempts; i++) {
      const receipt = await window.ethereum.request({
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      });
      if (receipt) return receipt;
      await new Promise(r => setTimeout(r, 3000)); // wait 3s between polls
    }
    return null; // timed out
  }

  const purchaseTypeLabels = { chicken: 'Chicken', feed: 'Feed', eggs: 'Eggs' };

  // ── Auth ────────────────────────────────────────
  const logoutBtn = $('logout-btn');
  const adminUserLabel = $('admin-user-label');
  const sidebarUser = $('sidebar-user-info');

  const accessDenied = $('access-denied');
  const adminContent = $('admin-content-wrap');
  const adminSidebar = $('admin-sidebar');
  const loginPrompt = $('admin-login-prompt');
  const loginForm = $('admin-login-form');
  const loginError = $('admin-login-error');

  function updateAuthUI() {
    if (API.isLoggedIn() && API.isAdmin()) {
      if (logoutBtn) show(logoutBtn);
      if (adminUserLabel) show(adminUserLabel);
      if (sidebarUser) sidebarUser.textContent = 'Admin';
    } else {
      if (logoutBtn) hide(logoutBtn);
      if (adminUserLabel) hide(adminUserLabel);
    }
  }

  function checkAdminAccess() {
    if (API.isLoggedIn() && API.isAdmin()) {
      if (loginPrompt) hide(loginPrompt);
      if (accessDenied) hide(accessDenied);
      if (adminContent) show(adminContent);
      if (adminSidebar) show(adminSidebar);
      return true;
    }
    if (API.isLoggedIn() && !API.isAdmin()) {
      if (loginPrompt) hide(loginPrompt);
      if (accessDenied) show(accessDenied);
      if (adminContent) hide(adminContent);
      if (adminSidebar) hide(adminSidebar);
      return false;
    }
    // Not logged in
    if (loginPrompt) show(loginPrompt);
    if (accessDenied) hide(accessDenied);
    if (adminContent) hide(adminContent);
    if (adminSidebar) hide(adminSidebar);
    return false;
  }

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('admin-user').value.trim();
    const password = $('admin-pass').value;
    const btn = $('admin-login-btn');

    if (loginError) hide(loginError);
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in...'; }

    try {
      await API.adminLogin(username, password);
      updateAuthUI();
      if (checkAdminAccess()) {
        toast('Login successful');
        loadAdmin();
      }
    } catch (err) {
      if (loginError) {
        loginError.textContent = err.message;
        show(loginError);
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
    }
  });

  logoutBtn?.addEventListener('click', () => {
    API.logout();
    updateAuthUI();
    location.reload();
  });

  updateAuthUI();
  checkAdminAccess();

  // ── Sidebar Navigation ─────────────────────────
  const sidebarLinks = document.querySelectorAll('.sidebar-link[data-section]');
  const sections = document.querySelectorAll('.admin-section');
  const pageTitle = $('page-title');

  function switchSection(name) {
    sidebarLinks.forEach(l => l.classList.toggle('active', l.dataset.section === name));
    sections.forEach(s => s.classList.toggle('active', s.id === 'section-' + name));
    if (pageTitle) {
      const activeLink = document.querySelector(`.sidebar-link[data-section="${name}"]`);
      pageTitle.textContent = activeLink?.querySelector('.link-text')?.textContent || 'Dashboard';
    }
  }

  sidebarLinks.forEach(link => {
    link.addEventListener('click', () => switchSection(link.dataset.section));
  });

  // ── Mobile Sidebar Toggle ──────────────────────
  const sidebar = document.querySelector('.sidebar');
  const sidebarToggle = $('sidebar-toggle');
  const sidebarOverlay = document.querySelector('.sidebar-overlay');

  sidebarToggle?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    sidebarOverlay?.classList.toggle('open');
  });

  sidebarOverlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('open');
  });

  // ── Admin Data Loading ─────────────────────────
  const alertBadge = $('p1-badge');
  const economyForm = $('economy-form');
  const withdrawalBody = $('withdrawal-body');
  const userList = $('user-list');
  let usersCurrentPage = 1;
  let usersSearchTerm = '';
  const wdStatusFilter = $('wd-status-filter');

  async function loadAdmin() {
    if (!API.isLoggedIn() || !API.isAdmin()) return;
    await Promise.all([
      loadDashboard(), loadAlerts(), loadEconomy(),
      loadWithdrawals(), loadWithdrawalStats(),
      loadUsers(), loadPurchaseStats(), loadSpecies(),
    ]);
  }

  wdStatusFilter?.addEventListener('change', () => loadWithdrawals());

  // ── Dashboard ───────────────────────────────────
  async function loadDashboard() {
    try {
      const d = await API.admin.getDashboard();

      // Purchases
      const el = (id, val) => { const e = $(id); if (e) e.textContent = val; };
      el('dash-purchases-total', fmtUSDT(d.purchases.total));
      el('dash-purchases-today', fmtUSDT(d.purchases.today));
      el('dash-purchases-month', fmtUSDT(d.purchases.month));

      // Withdrawals
      el('dash-withdrawals-total', fmtUSDT(d.withdrawals.total));
      el('dash-withdrawals-today', fmtUSDT(d.withdrawals.today));
      el('dash-withdrawals-month', fmtUSDT(d.withdrawals.month));

      // Counters
      el('dash-users', String(d.users));
      el('dash-chickens', String(d.active_chickens));
      el('dash-eggs', String(d.total_eggs));
      el('dash-pending-wd', String(d.withdrawals.pending));
      el('dash-purchases-count', String(d.purchases.count));
    } catch (_) { /* ignore */ }
  }

  // ── Alerts ─────────────────────────────────────
  async function loadAlerts() {
    try {
      const data = await API.admin.getAlerts();
      const count = data.p1.starvation_risk + data.p1.withdrawal_sla_breach;
      if (alertBadge) {
        alertBadge.textContent = String(count);
        alertBadge.style.display = count > 0 ? '' : 'none';
      }

      const alertDetails = $('alert-details');
      if (alertDetails) {
        let html = '';
        if (data.p1.starvation_risk > 0)
          html += `<div class="alert-item danger">Starvation risk: ${data.p1.starvation_risk} chickens at risk</div>`;
        if (data.p1.withdrawal_sla_breach > 0)
          html += `<div class="alert-item danger">SLA breach: ${data.p1.withdrawal_sla_breach} delayed withdrawals</div>`;
        if (!html) html = '<p class="text-soft">No active P1 alerts.</p>';
        alertDetails.innerHTML = html;
      }
    } catch (_) { /* ignore */ }
  }

  // ── Economy ────────────────────────────────────
  async function loadEconomy() {
    try {
      const configs = await API.admin.getEconomy();
      if (!economyForm) return;

      const editableKeys = [
        { key: 'egg_system_price', label: 'Egg Sell Price (USDT)', type: 'number' },
        { key: 'egg_purchase_price', label: 'Egg Buy Price (USDT)', type: 'number' },
        { key: 'feed_unit_price', label: 'Feed Unit Price (USDT)', type: 'number' },
        { key: 'egg_to_chick_feed', label: 'Incubation Feed Cost', type: 'number' },
        { key: 'egg_incubation_hours', label: 'Incubation Duration (hours)', type: 'number' },
        { key: 'egg_hatch_success_rate', label: 'Hatch Success Rate (0-1)', type: 'number' },
        { key: 'chick_growth_days', label: 'Chick Growth (days)', type: 'number' },
        { key: 'chick_to_adult_feed', label: 'Chick to Adult Feed Cost', type: 'number' },
        { key: 'starvation_death_hours', label: 'Starvation Death (hours)', type: 'number' },
        { key: 'withdrawal_fee_rate', label: 'Withdrawal Fee Rate', type: 'number' },
        { key: 'withdrawal_min_amount', label: 'Min Withdrawal (USDT)', type: 'number' },
        { key: 'max_withdrawals_per_day', label: 'Max Withdrawals/Day', type: 'number' },
        { key: 'onboarding_free_feed', label: 'Onboarding Free Feed', type: 'number' },
        { key: 'bep20_confirmations', label: 'BEP20 Confirmations', type: 'number' },
        { key: 'allow_new_registrations', label: 'Allow New Registrations', type: 'toggle' },
      ];

      economyForm.innerHTML = editableKeys.map(({ key, label, type }) => {
        const val = configs[key] || '';
        if (type === 'toggle') {
          return `<div class="config-row">
            <label>${label}</label>
            <button class="btn ${val === 'true' ? 'btn-primary' : 'btn-danger'} btn-sm config-toggle" data-key="${key}" data-val="${val}">
              ${val === 'true' ? 'Open' : 'Blocked'}
            </button>
          </div>`;
        }
        return `<div class="config-row">
          <label>${label}</label>
          <input class="input" type="number" step="any" data-key="${key}" value="${val}" />
          <button class="btn btn-primary btn-sm config-save" data-key="${key}">Save</button>
        </div>`;
      }).join('');

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

      economyForm.querySelectorAll('.config-toggle').forEach(btn => {
        btn.addEventListener('click', async () => {
          const key = btn.dataset.key;
          const newVal = btn.dataset.val === 'true' ? 'false' : 'true';
          try {
            await API.admin.setEconomy(key, newVal);
            btn.dataset.val = newVal;
            btn.textContent = newVal === 'true' ? 'Open' : 'Blocked';
            btn.className = `btn ${newVal === 'true' ? 'btn-primary' : 'btn-danger'} btn-sm config-toggle`;
            toast(`${key} = ${newVal}`);
          } catch (e) { toast(e.message, true); }
        });
      });
    } catch (e) { toast(e.message, true); }
  }

  // ── Withdrawal Stats ────────────────────────────
  async function loadWithdrawalStats() {
    try {
      const s = await API.admin.getWithdrawalStats();
      const el = (id, val) => { const e = $(id); if (e) e.textContent = val; };

      el('wd-total-amount', fmtUSDT(s.completed.total.amount));
      el('wd-total-count', `${s.completed.total.count} withdrawals`);
      el('wd-today-amount', fmtUSDT(s.completed.today.amount));
      el('wd-today-count', `${s.completed.today.count} withdrawals`);
      el('wd-month-amount', fmtUSDT(s.completed.month.amount));
      el('wd-month-count', `${s.completed.month.count} withdrawals`);
      el('wd-fees-total', fmtUSDT(s.fees.total));
      el('wd-fees-month', `Month: ${fmtUSDT(s.fees.month)}`);

      // Status counters
      el('wd-count-pending', String(s.status_counts.pending || 0));
      el('wd-count-completed', String(s.status_counts.completed || 0));
      el('wd-count-cancelled', String(s.status_counts.cancelled || 0));

      // Top users
      const topBody = $('wd-top-users-body');
      if (topBody) {
        if (s.top_users.length === 0) {
          topBody.innerHTML = '<tr><td colspan="3" class="text-soft">No completed withdrawals.</td></tr>';
        } else {
          topBody.innerHTML = s.top_users.map(u => `
            <tr>
              <td title="${u.wallet}">${shortWallet(u.wallet)}</td>
              <td>${fmtUSDT(u.total)}</td>
              <td>${u.count}</td>
            </tr>
          `).join('');
        }
      }
    } catch (_) { /* ignore */ }
  }

  // ── Withdrawals ────────────────────────────────
  async function loadWithdrawals() {
    if (!withdrawalBody) return;
    try {
      const status = wdStatusFilter?.value || 'pending';
      const data = await API.admin.getWithdrawals(status);

      if (data.withdrawals.length === 0) {
        withdrawalBody.innerHTML = `<tr><td colspan="8" class="text-soft">No ${status} withdrawals.</td></tr>`;
      } else {
        withdrawalBody.innerHTML = data.withdrawals.map(w => {
          const statusClass = w.status === 'completed' ? 'ok' : w.status === 'cancelled' ? 'danger' : 'warn';
          return `
          <tr>
            <td>#${w.id}</td>
            <td title="${esc(w.wallet_address || w.user_wallet || '')}">${esc(shortWallet(w.wallet_address || w.user_wallet))}</td>
            <td>${fmtUSDT(w.amount)}</td>
            <td>${fmtUSDT(w.fee_amount)}</td>
            <td>${fmtUSDT(w.net_amount)}</td>
            <td><span class="status-pill ${esc(statusClass)}">${esc(w.status)}</span></td>
            <td>${esc(new Date(w.created_at).toLocaleString())}</td>
            <td>
              ${w.status === 'pending' ? `<button class="btn btn-primary btn-sm wd-pay" data-id="${w.id}" data-wallet="${esc(w.wallet_address || w.user_wallet || '')}" data-amount="${w.net_amount}">Pay</button>
              <button class="btn btn-danger btn-sm wd-cancel" data-id="${w.id}">Cancel</button>` : ''}
              ${w.tx_hash ? `<span title="${esc(w.tx_hash)}" style="font-size:.75rem;color:var(--text-soft)">${esc(w.tx_hash.slice(0, 10))}...</span>` : ''}
            </td>
          </tr>`;
        }).join('');

        // Pay buttons — send USDT via MetaMask or enter TX hash, then complete
        withdrawalBody.querySelectorAll('.wd-pay').forEach(btn => {
          btn.addEventListener('click', async () => {
            try {
              const wId = btn.dataset.id;
              const payTo = btn.dataset.wallet;
              const netAmount = parseFloat(btn.dataset.amount);

              let txHash = null;
              let confirmed = false;

              if (typeof window.ethereum !== 'undefined') {
                try {
                  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                  const from = accounts[0];

                  // Switch MetaMask to BSC network before sending
                  await API.ensureBSC();

                  const USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955';

                  // Convert amount to wei using string math to avoid floating-point precision loss
                  const [intPart, decPart = ''] = String(netAmount).split('.');
                  const amountStr = intPart + decPart.padEnd(18, '0').slice(0, 18);
                  const amountWei = '0x' + BigInt(amountStr).toString(16);

                  const transferData = '0xa9059cbb'
                    + payTo.replace('0x', '').toLowerCase().padStart(64, '0')
                    + amountWei.replace('0x', '').padStart(64, '0');

                  btn.disabled = true;
                  btn.textContent = 'Sending...';

                  const tx = await window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [{
                      from,
                      to: USDT_CONTRACT,
                      data: transferData,
                      value: '0x0',
                      gas: '0x186A0',
                    }],
                  });

                  txHash = tx;
                  toast(`TX sent: ${shortWallet(tx)} — waiting for confirmation...`);
                  btn.textContent = 'Confirming...';

                  // Poll for transaction receipt until mined
                  const receipt = await waitForTxReceipt(tx);

                  if (receipt && receipt.status === '0x1') {
                    confirmed = true;
                    toast(`TX confirmed on-chain: ${shortWallet(tx)}`);
                  } else {
                    toast('Transaction FAILED on-chain. Withdrawal NOT marked as completed.', true);
                    btn.disabled = false;
                    btn.textContent = 'Pay';
                    return;
                  }
                } catch (mmErr) {
                  btn.disabled = false;
                  btn.textContent = 'Pay';
                  toast('MetaMask cancelled or transaction failed.', true);
                }
              }

              // Manual fallback: admin already sent USDT outside the app
              if (!confirmed && !txHash) {
                txHash = prompt('MetaMask unavailable. Enter TX hash of an already confirmed BEP20 USDT transfer:');
                if (txHash) confirmed = true;
              }

              if (confirmed && txHash) {
                const r = await API.admin.completeWithdrawal(wId, txHash);
                toast(`Withdrawal #${r.withdrawal_id} completed`);
              }
              loadWithdrawals();
              loadWithdrawalStats();
            } catch (e) { toast(e.message, true); }
          });
        });

        // Cancel buttons
        withdrawalBody.querySelectorAll('.wd-cancel').forEach(btn => {
          btn.addEventListener('click', async () => {
            const note = prompt('Cancellation reason (optional):');
            try {
              await API.admin.cancelWithdrawal(btn.dataset.id, note || '');
              toast(`Withdrawal #${btn.dataset.id} cancelled and refunded`);
              loadWithdrawals();
              loadWithdrawalStats();
            } catch (e) { toast(e.message, true); }
          });
        });
      }
    } catch (e) { toast(e.message, true); }
  }

  // ── Users ──────────────────────────────────────

  // Search handlers
  const userSearchInput = $('user-search');
  const userSearchBtn = $('user-search-btn');
  if (userSearchBtn) {
    userSearchBtn.addEventListener('click', () => {
      usersSearchTerm = (userSearchInput?.value || '').trim();
      usersCurrentPage = 1;
      loadUsers();
    });
  }
  if (userSearchInput) {
    userSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { userSearchBtn?.click(); }
    });
  }

  // Bonus modal logic
  const bonusModal = $('bonus-modal');
  const bonusType = $('bonus-type');
  const bonusQty = $('bonus-qty');
  const bonusQtyWrap = $('bonus-qty-wrap');
  const bonusSpeciesWrap = $('bonus-species-wrap');
  const bonusSpecies = $('bonus-species');
  const bonusConfirm = $('bonus-confirm');
  const bonusCancel = $('bonus-cancel');
  const bonusTitle = $('bonus-modal-title');
  let bonusUserId = null;

  if (bonusType) {
    bonusType.addEventListener('change', () => {
      if (bonusType.value === 'chicken') {
        hide(bonusQtyWrap);
        show(bonusSpeciesWrap);
      } else {
        show(bonusQtyWrap);
        hide(bonusSpeciesWrap);
      }
    });
  }
  if (bonusCancel) bonusCancel.addEventListener('click', () => hide(bonusModal));
  if (bonusConfirm) {
    bonusConfirm.addEventListener('click', async () => {
      if (!bonusUserId) return;
      const t = bonusType.value;
      const data = { type: t };
      if (t === 'chicken') {
        data.species_id = parseInt(bonusSpecies.value, 10);
      } else {
        data.quantity = parseFloat(bonusQty.value);
      }
      try {
        bonusConfirm.disabled = true;
        await API.admin.giveBonus(bonusUserId, data);
        toast(`Bonus sent: ${t}`);
        hide(bonusModal);
        loadUsers();
      } catch (e) { toast(e.message, true); }
      finally { bonusConfirm.disabled = false; }
    });
  }

  async function openBonusModal(userId, walletShort) {
    bonusUserId = userId;
    if (bonusTitle) bonusTitle.textContent = `Give Bonus — ${walletShort}`;
    if (bonusType) bonusType.value = 'feed';
    if (bonusQty) bonusQty.value = '1';
    show(bonusQtyWrap);
    hide(bonusSpeciesWrap);

    // Load species into dropdown
    if (bonusSpecies && bonusSpecies.options.length <= 1) {
      try {
        const species = await API.admin.getSpecies();
        bonusSpecies.innerHTML = species.map(s =>
          `<option value="${s.id}">${s.name} ($${parseFloat(s.purchase_price).toFixed(2)})</option>`
        ).join('');
      } catch (_) {}
    }

    show(bonusModal);
  }

  async function loadUsers() {
    if (!userList) return;
    try {
      const data = await API.admin.getUsers(usersCurrentPage, usersSearchTerm);

      // Summary stats
      const totalUsers = $('users-total');
      if (totalUsers) totalUsers.textContent = data.total;

      if (data.users.length > 0) {
        const sumBalance = data.users.reduce((s, u) => s + u.balance_usdt, 0);
        const sumChickens = data.users.reduce((s, u) => s + u.chickens_alive, 0);
        const sumWithdrawn = data.users.reduce((s, u) => s + u.total_withdrawn, 0);
        const tb = $('users-total-balance');
        const tc = $('users-total-chickens');
        const tw = $('users-total-withdrawn');
        if (tb) tb.textContent = '$' + sumBalance.toFixed(2);
        if (tc) tc.textContent = sumChickens;
        if (tw) tw.textContent = '$' + sumWithdrawn.toFixed(2);
      }

      if (data.users.length === 0) {
        userList.innerHTML = '<p class="text-soft">No users found.</p>';
      } else {
        userList.innerHTML = data.users.map(u => {
          const ws = shortWallet(u.wallet_address);
          const bannedClass = u.is_banned ? ' banned' : '';
          return `<div class="user-card${bannedClass}">
            <div class="user-card-header">
              <div class="user-card-wallet">
                <span class="wallet-addr" title="${esc(u.wallet_address)}" onclick="navigator.clipboard.writeText('${esc(u.wallet_address)}');this.style.color='var(--primary)'">${esc(ws)}</span>
                <span class="status-pill ${u.is_banned ? 'danger' : 'ok'}">${u.is_banned ? 'Banned' : 'Active'}</span>
                ${u.role === 'admin' ? '<span class="status-pill info">Admin</span>' : ''}
              </div>
              <div class="user-card-actions">
                <button class="btn btn-ghost btn-sm user-bonus" data-id="${u.id}" data-wallet="${ws}">Bonus</button>
                <button class="btn ${u.is_banned ? 'btn-primary' : 'btn-danger'} btn-sm user-ban-btn" data-id="${u.id}" data-banned="${u.is_banned}">
                  ${u.is_banned ? 'Unban' : 'Ban'}
                </button>
              </div>
            </div>
            <div class="user-card-stats">
              <div class="user-stat">
                <div class="user-stat-value">$${u.balance_usdt.toFixed(2)}</div>
                <div class="user-stat-label">Balance</div>
              </div>
              <div class="user-stat">
                <div class="user-stat-value">${u.feed_balance.toFixed(1)}</div>
                <div class="user-stat-label">Feed</div>
              </div>
              <div class="user-stat">
                <div class="user-stat-value">${u.chickens_alive}</div>
                <div class="user-stat-label">Chickens</div>
              </div>
              <div class="user-stat">
                <div class="user-stat-value">${u.eggs_available}</div>
                <div class="user-stat-label">Eggs</div>
              </div>
              <div class="user-stat">
                <div class="user-stat-value">$${u.total_spent.toFixed(2)}</div>
                <div class="user-stat-label">Spent</div>
              </div>
              <div class="user-stat">
                <div class="user-stat-value">$${u.total_withdrawn.toFixed(2)}</div>
                <div class="user-stat-label">Withdrawn</div>
              </div>
            </div>
            <div class="user-card-footer">
              <div class="user-card-meta">
                <span>Joined ${new Date(u.created_at).toLocaleDateString()}</span>
                <span>Last login: ${u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}</span>
                <span>Chickens total: ${u.chickens_total} (${u.chickens_dead} dead)</span>
                <span>Withdrawals: ${u.withdrawal_requests}</span>
              </div>
            </div>
          </div>`;
        }).join('');

        // Ban button handlers
        userList.querySelectorAll('.user-ban-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const newBanned = btn.dataset.banned !== 'true';
            try {
              await API.admin.banUser(btn.dataset.id, newBanned);
              toast(`User ${newBanned ? 'banned' : 'unbanned'}`);
              loadUsers();
            } catch (e) { toast(e.message, true); }
          });
        });

        // Bonus button handlers
        userList.querySelectorAll('.user-bonus').forEach(btn => {
          btn.addEventListener('click', () => {
            openBonusModal(parseInt(btn.dataset.id, 10), btn.dataset.wallet);
          });
        });
      }

      // Pagination
      const paginationEl = $('user-pagination');
      if (paginationEl) {
        const totalPages = Math.ceil(data.total / data.limit);
        if (totalPages <= 1) {
          paginationEl.innerHTML = '';
        } else {
          let html = '';
          if (usersCurrentPage > 1) {
            html += `<button class="btn btn-ghost btn-sm" data-page="${usersCurrentPage - 1}">&laquo; Prev</button>`;
          }
          const startPage = Math.max(1, usersCurrentPage - 2);
          const endPage = Math.min(totalPages, usersCurrentPage + 2);
          for (let p = startPage; p <= endPage; p++) {
            html += `<button class="btn ${p === usersCurrentPage ? 'btn-primary' : 'btn-ghost'} btn-sm" data-page="${p}">${p}</button>`;
          }
          if (usersCurrentPage < totalPages) {
            html += `<button class="btn btn-ghost btn-sm" data-page="${usersCurrentPage + 1}">Next &raquo;</button>`;
          }
          paginationEl.innerHTML = html;
          paginationEl.querySelectorAll('button[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
              usersCurrentPage = parseInt(btn.dataset.page, 10);
              loadUsers();
            });
          });
        }
      }
    } catch (e) { toast(e.message, true); }
  }

  // ── Purchase Stats ─────────────────────────────
  async function loadPurchaseStats() {
    try {
      const s = await API.admin.getPurchaseStats();
      const el = (id, val) => { const e = $(id); if (e) e.textContent = val; };

      // Totals
      el('purch-total', fmtUSDT(s.totals.all.total));
      el('purch-total-count', `${s.totals.all.count} purchases`);
      el('purch-today', fmtUSDT(s.totals.today.total));
      el('purch-today-count', `${s.totals.today.count} purchases`);
      el('purch-month', fmtUSDT(s.totals.month.total));
      el('purch-month-count', `${s.totals.month.count} purchases`);

      // By type
      const bt = s.by_type;
      el('purch-chicken-count', String(bt.chicken?.count || 0));
      el('purch-chicken-total', fmtUSDT(bt.chicken?.total));
      el('purch-feed-count', String(bt.feed?.count || 0));
      el('purch-feed-total', fmtUSDT(bt.feed?.total));
      el('purch-eggs-count', String(bt.eggs?.count || 0));
      el('purch-eggs-total', fmtUSDT(bt.eggs?.total));

      // Top species
      const topBody = $('top-species-body');
      if (topBody) {
        if (s.top_species.length === 0) {
          topBody.innerHTML = '<tr><td colspan="4" class="text-soft">No chickens sold yet.</td></tr>';
        } else {
          topBody.innerHTML = s.top_species.map((sp, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${sp.species_name}</strong></td>
              <td>${sp.count}</td>
              <td>${fmtUSDT(sp.total)}</td>
            </tr>
          `).join('');
        }
      }

      // Recent purchases
      const purchBody = $('purchases-body');
      if (purchBody) {
        if (s.recent.length === 0) {
          purchBody.innerHTML = '<tr><td colspan="5" class="text-soft">No purchases recorded.</td></tr>';
        } else {
          purchBody.innerHTML = s.recent.map(p => `
            <tr>
              <td>#${p.id}</td>
              <td title="${p.user_wallet || ''}">${shortWallet(p.user_wallet)}</td>
              <td><span class="status-pill info">${purchaseTypeLabels[p.purchase_type] || p.purchase_type}</span></td>
              <td>${fmtUSDT(p.expected_amount)}</td>
              <td>${new Date(p.confirmed_at || p.created_at).toLocaleString()}</td>
            </tr>
          `).join('');
        }
      }
    } catch (_) { /* ignore */ }
  }

  // ── Species (Emissor de Galinhas) ─────────────
  const speciesBody = $('species-body');
  const speciesFormWrap = $('species-form-wrap');
  const speciesForm = $('species-form');
  const speciesFormTitle = $('species-form-title');
  const speciesAddBtn = $('species-add-btn');
  const speciesCancelBtn = $('species-cancel-btn');
  let editingSpeciesId = null;

  function resetSpeciesForm() {
    editingSpeciesId = null;
    if (speciesFormTitle) speciesFormTitle.textContent = 'New Species';
    $('sp-name').value = '';
    $('sp-price').value = '';
    $('sp-eggs').value = '';
    $('sp-feed').value = '';
    $('sp-lifespan').value = '';
    $('sp-weight').value = '0';
    if (speciesFormWrap) hide(speciesFormWrap);
  }

  speciesAddBtn?.addEventListener('click', () => {
    resetSpeciesForm();
    if (speciesFormWrap) show(speciesFormWrap);
  });

  speciesCancelBtn?.addEventListener('click', () => resetSpeciesForm());

  speciesForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: $('sp-name').value.trim(),
      purchase_price: $('sp-price').value,
      eggs_per_day: $('sp-eggs').value,
      feed_per_day: $('sp-feed').value,
      lifespan_days: $('sp-lifespan').value,
      species_weight: $('sp-weight').value || '0',
    };

    try {
      if (editingSpeciesId) {
        await API.admin.updateSpecies(editingSpeciesId, data);
        toast('Species updated');
      } else {
        await API.admin.createSpecies(data);
        toast('Species created');
      }
      resetSpeciesForm();
      loadSpecies();
    } catch (err) {
      toast(err.message, true);
    }
  });

  async function loadSpecies() {
    if (!speciesBody) return;
    try {
      const species = await API.admin.getSpecies();
      if (species.length === 0) {
        speciesBody.innerHTML = '<tr><td colspan="9" class="text-soft">No species registered. Click "+ New Species" to create one.</td></tr>';
        return;
      }
      speciesBody.innerHTML = species.map(s => `
        <tr>
          <td>#${s.id}</td>
          <td><strong>${s.name}</strong></td>
          <td>${parseFloat(s.purchase_price).toFixed(2)} USDT</td>
          <td>${parseFloat(s.eggs_per_day).toFixed(1)}</td>
          <td>${parseFloat(s.feed_per_day).toFixed(1)}</td>
          <td>${s.lifespan_days}d</td>
          <td>${(parseFloat(s.species_weight) * 100).toFixed(1)}%</td>
          <td><span class="status-pill ${s.is_active ? 'ok' : 'danger'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
          <td style="display:flex;gap:.3rem;flex-wrap:wrap">
            <button class="btn btn-outline btn-sm sp-edit" data-id="${s.id}" data-name="${s.name}" data-price="${s.purchase_price}" data-eggs="${s.eggs_per_day}" data-feed="${s.feed_per_day}" data-life="${s.lifespan_days}" data-weight="${s.species_weight}">Edit</button>
            <button class="btn ${s.is_active ? 'btn-danger' : 'btn-primary'} btn-sm sp-toggle" data-id="${s.id}" data-active="${s.is_active}">${s.is_active ? 'Disable' : 'Enable'}</button>
          </td>
        </tr>
      `).join('');

      speciesBody.querySelectorAll('.sp-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          editingSpeciesId = btn.dataset.id;
          if (speciesFormTitle) speciesFormTitle.textContent = `Edit: ${btn.dataset.name}`;
          $('sp-name').value = btn.dataset.name;
          $('sp-price').value = btn.dataset.price;
          $('sp-eggs').value = btn.dataset.eggs;
          $('sp-feed').value = btn.dataset.feed;
          $('sp-lifespan').value = btn.dataset.life;
          $('sp-weight').value = btn.dataset.weight;
          if (speciesFormWrap) show(speciesFormWrap);
        });
      });

      speciesBody.querySelectorAll('.sp-toggle').forEach(btn => {
        btn.addEventListener('click', async () => {
          const newActive = btn.dataset.active !== 'true';
          try {
            if (!newActive) {
              await API.admin.deleteSpecies(btn.dataset.id);
            } else {
              await API.admin.updateSpecies(btn.dataset.id, { is_active: true });
            }
            toast(`Species ${newActive ? 'enabled' : 'disabled'}`);
            loadSpecies();
          } catch (err) { toast(err.message, true); }
        });
      });
    } catch (e) { toast(e.message, true); }
  }

  // ── Auto-refresh ───────────────────────────────
  if (API.isLoggedIn() && API.isAdmin()) {
    checkAdminAccess();
    loadAdmin();
    setInterval(loadAdmin, 60000);
  }
})();
