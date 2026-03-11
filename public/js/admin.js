/**
 * admin.js — Admin Panel Controller for Galinha Farm
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
  const authArea = $('auth-area');
  const sidebarUser = $('sidebar-user-info');

  function updateAuthUI() {
    if (API.isLoggedIn()) {
      if (connectBtn) hide(connectBtn);
      if (logoutBtn) show(logoutBtn);
      if (walletLabel) walletLabel.textContent = shortWallet(API.getUser()?.wallet_address);
      if (sidebarUser) sidebarUser.textContent = shortWallet(API.getUser()?.wallet_address);
    } else {
      if (connectBtn) show(connectBtn);
      if (logoutBtn) hide(logoutBtn);
    }
  }

  connectBtn?.addEventListener('click', async () => {
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';
    try {
      await API.connectMetaMask();
      updateAuthUI();
      toast('Connected successfully!');
      loadAdmin();
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
  const userBody = $('user-body');
  const depositBody = $('deposit-body');
  const depConfirmed = $('dep-confirmed');
  const depPending = $('dep-pending');
  const depVolume = $('dep-volume');
  const depStatusFilter = $('dep-status-filter');

  async function loadAdmin() {
    if (!API.isLoggedIn() || !API.isAdmin()) return;
    await Promise.all([loadAlerts(), loadEconomy(), loadWithdrawals(), loadUsers(), loadAdminDeposits()]);
  }

  depStatusFilter?.addEventListener('change', () => loadAdminDeposits());

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
          html += `<div class="alert-item danger">SLA breach: ${data.p1.withdrawal_sla_breach} withdrawals overdue</div>`;
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

  // ── Withdrawals ────────────────────────────────
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
              <button class="btn btn-danger btn-sm wd-reject" data-id="${w.id}">Reject</button>
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

  // ── Users ──────────────────────────────────────
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
              <button class="btn ${u.is_banned ? 'btn-primary' : 'btn-danger'} btn-sm user-ban" data-id="${u.id}" data-banned="${u.is_banned}">
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

  // ── Deposits ───────────────────────────────────
  async function loadAdminDeposits() {
    if (!depositBody) return;
    try {
      const status = depStatusFilter?.value || 'all';
      const data = await API.admin.getDeposits(status);

      if (depConfirmed) depConfirmed.textContent = String(data.counts.confirmed || 0);
      if (depPending) depPending.textContent = String(data.counts.pending || 0);
      if (depVolume) depVolume.textContent = `${data.total_confirmed_volume.toFixed(2)} USDT`;

      if (data.deposits.length === 0) {
        depositBody.innerHTML = '<tr><td colspan="7" class="text-soft">No deposits found.</td></tr>';
      } else {
        depositBody.innerHTML = data.deposits.map(d => {
          const statusClass = d.status === 'confirmed' ? 'ok' : d.status === 'failed' ? 'danger' : 'warn';
          const txShort = d.tx_hash ? d.tx_hash.slice(0, 12) + '...' : '';
          return `<tr>
            <td>#${d.id}</td>
            <td title="${d.user_wallet || ''}">${shortWallet(d.user_wallet)}</td>
            <td>${parseFloat(d.amount).toFixed(2)} USDT</td>
            <td><span class="status-pill ${statusClass}">${d.status}</span></td>
            <td>${d.confirmations}</td>
            <td title="${d.tx_hash || ''}">${txShort}</td>
            <td>${new Date(d.created_at).toLocaleString()}</td>
          </tr>`;
        }).join('');
      }
    } catch (e) { toast(e.message, true); }
  }

  // ── Auto-refresh ───────────────────────────────
  if (API.isLoggedIn() && API.isAdmin()) {
    loadAdmin();
    setInterval(loadAdmin, 60000);
  }
})();
