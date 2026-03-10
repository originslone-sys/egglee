(function () {
  const page = document.body.dataset.page;

  if (page === 'client') {
    const state = {
      chickens: 24,
      eggs: 112,
      feed: 31.4,
      wallet: 84.2,
      autoFeed: false,
      collectedToday: 0,
    };

    const el = {
      chickens: document.getElementById('metric-chickens'),
      eggs: document.getElementById('metric-eggs'),
      feed: document.getElementById('metric-feed'),
      wallet: document.getElementById('metric-wallet'),
      farmStatus: document.getElementById('farm-status'),
      collectedToday: document.getElementById('collected-today'),
      collectBtn: document.getElementById('collect-btn'),
      feedBtn: document.getElementById('feed-btn'),
      autoBtn: document.getElementById('auto-feed-btn'),
    };

    const render = () => {
      el.chickens.textContent = String(state.chickens);
      el.eggs.textContent = String(state.eggs);
      el.feed.textContent = `${state.feed.toFixed(1)} units`;
      el.wallet.textContent = `${state.wallet.toFixed(2)} USDT`;
      el.collectedToday.textContent = String(state.collectedToday);
      el.autoBtn.textContent = state.autoFeed ? 'Disable Auto Feed' : 'Enable Auto Feed';

      if (state.feed <= 3) {
        el.farmStatus.textContent = 'Warning: feed is critically low. Chickens stop producing without feed.';
        el.farmStatus.classList.add('warning');
      } else {
        el.farmStatus.textContent = 'Farm is stable. Production is running normally.';
        el.farmStatus.classList.remove('warning');
      }
    };

    el.collectBtn?.addEventListener('click', () => {
      if (state.eggs === 0) return;
      state.collectedToday += state.eggs;
      state.wallet += state.eggs * 0.1;
      state.eggs = 0;
      render();
    });

    el.feedBtn?.addEventListener('click', () => {
      if (state.wallet < 1.2) return;
      state.wallet -= 1.2;
      state.feed += 10;
      render();
    });

    el.autoBtn?.addEventListener('click', () => {
      state.autoFeed = !state.autoFeed;
      render();
    });

    // simple mock production loop
    setInterval(() => {
      const feedCost = state.autoFeed ? 0.6 : 0.2;
      if (state.feed > feedCost) {
        state.feed -= feedCost;
        state.eggs += state.autoFeed ? 2 : 1;
      }
      render();
    }, 6000);

    render();
  }

  if (page === 'admin') {
    const registrationsToggle = document.getElementById('registrations-toggle');
    const regStatus = document.getElementById('registrations-status');
    const alertBadge = document.getElementById('p1-count');
    const fastPayBtn = document.getElementById('fast-pay-btn');

    let registrationsOpen = true;
    let p1Count = 3;

    const renderAdmin = () => {
      regStatus.textContent = registrationsOpen ? 'Open' : 'Blocked';
      regStatus.className = registrationsOpen ? 'status-pill ok' : 'status-pill danger';
      registrationsToggle.textContent = registrationsOpen ? 'Block New Users' : 'Enable New Users';
      alertBadge.textContent = String(p1Count);
    };

    registrationsToggle?.addEventListener('click', () => {
      registrationsOpen = !registrationsOpen;
      renderAdmin();
    });

    fastPayBtn?.addEventListener('click', () => {
      p1Count = Math.max(0, p1Count - 1);
      renderAdmin();
    });

    renderAdmin();
  }
})();
