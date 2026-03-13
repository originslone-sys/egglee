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
    if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }

    try {
      await API.adminLogin(username, password);
      updateAuthUI();
      if (checkAdminAccess()) {
        toast('Login realizado com sucesso');
        loadAdmin();
      }
    } catch (err) {
      if (loginError) {
        loginError.textContent = err.message;
        show(loginError);
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
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
  const userBody = $('user-body');
  const depositBody = $('deposit-body');
  const depConfirmed = $('dep-confirmed');
  const depPending = $('dep-pending');
  const depVolume = $('dep-volume');
  const depStatusFilter = $('dep-status-filter');

  async function loadAdmin() {
    if (!API.isLoggedIn() || !API.isAdmin()) return;
    await Promise.all([loadAlerts(), loadEconomy(), loadWithdrawals(), loadUsers(), loadAdminDeposits(), loadSpecies()]);
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
        { key: 'egg_system_price', label: 'Egg Sell Price (USDT)', type: 'number' },
        { key: 'egg_purchase_price', label: 'Egg Buy Price (USDT)', type: 'number' },
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
              <button class="btn btn-primary btn-sm wd-process" data-id="${w.id}">Fazer pagamento</button>
              <button class="btn btn-danger btn-sm wd-reject" data-id="${w.id}">Reject</button>
            </td>
          </tr>
        `).join('');

        withdrawalBody.querySelectorAll('.wd-process').forEach(btn => {
          btn.addEventListener('click', async () => {
            try {
              const r = await API.admin.processWithdrawal(btn.dataset.id);
              toast(`Withdrawal #${r.withdrawal_id} — pay ${parseFloat(r.net_amount).toFixed(2)} USDT to ${shortWallet(r.pay_to)}`);

              // Try MetaMask BEP20 USDT transfer
              let txHash = null;
              if (typeof window.ethereum !== 'undefined') {
                try {
                  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                  const from = accounts[0];

                  // USDT BEP20 contract on BSC
                  const USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955';
                  const amount = parseFloat(r.net_amount);
                  const amountWei = '0x' + BigInt(Math.round(amount * 1e18)).toString(16);

                  // ERC20 transfer(address,uint256) function selector
                  const transferData = '0xa9059cbb'
                    + r.pay_to.replace('0x', '').toLowerCase().padStart(64, '0')
                    + amountWei.replace('0x', '').padStart(64, '0');

                  const tx = await window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [{
                      from,
                      to: USDT_CONTRACT,
                      data: transferData,
                      chainId: '0x38', // BSC mainnet
                    }],
                  });
                  txHash = tx;
                  toast(`TX sent: ${shortWallet(tx)}`);
                } catch (mmErr) {
                  toast('MetaMask cancelled or failed — enter TX hash manually', true);
                }
              }

              if (!txHash) {
                txHash = prompt('Enter TX hash manually (after sending BEP20 USDT):');
              }

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
    if (speciesFormTitle) speciesFormTitle.textContent = 'Nova Espécie';
    $('sp-name').value = '';
    $('sp-price').value = '';
    $('sp-eggs').value = '';
    $('sp-feed').value = '';
    $('sp-lifespan').value = '';
    $('sp-hatch').value = '0';
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
      hatch_probability: $('sp-hatch').value || '0',
      species_weight: $('sp-weight').value || '0',
    };

    try {
      if (editingSpeciesId) {
        await API.admin.updateSpecies(editingSpeciesId, data);
        toast('Espécie atualizada');
      } else {
        await API.admin.createSpecies(data);
        toast('Espécie criada');
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
        speciesBody.innerHTML = '<tr><td colspan="10" class="text-soft">Nenhuma espécie cadastrada. Clique em "+ Nova Espécie" para criar.</td></tr>';
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
          <td>${(parseFloat(s.hatch_probability) * 100).toFixed(1)}%</td>
          <td>${(parseFloat(s.species_weight) * 100).toFixed(1)}%</td>
          <td><span class="status-pill ${s.is_active ? 'ok' : 'danger'}">${s.is_active ? 'Ativa' : 'Inativa'}</span></td>
          <td style="display:flex;gap:.3rem;flex-wrap:wrap">
            <button class="btn btn-outline btn-sm sp-edit" data-id="${s.id}" data-name="${s.name}" data-price="${s.purchase_price}" data-eggs="${s.eggs_per_day}" data-feed="${s.feed_per_day}" data-life="${s.lifespan_days}" data-hatch="${s.hatch_probability}" data-weight="${s.species_weight}">Editar</button>
            <button class="btn ${s.is_active ? 'btn-danger' : 'btn-primary'} btn-sm sp-toggle" data-id="${s.id}" data-active="${s.is_active}">${s.is_active ? 'Desativar' : 'Ativar'}</button>
          </td>
        </tr>
      `).join('');

      speciesBody.querySelectorAll('.sp-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          editingSpeciesId = btn.dataset.id;
          if (speciesFormTitle) speciesFormTitle.textContent = `Editar: ${btn.dataset.name}`;
          $('sp-name').value = btn.dataset.name;
          $('sp-price').value = btn.dataset.price;
          $('sp-eggs').value = btn.dataset.eggs;
          $('sp-feed').value = btn.dataset.feed;
          $('sp-lifespan').value = btn.dataset.life;
          $('sp-hatch').value = btn.dataset.hatch;
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
            toast(`Espécie ${newActive ? 'ativada' : 'desativada'}`);
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
