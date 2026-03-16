/**
 * api.js — HTTP client layer for Egglee
 * Handles auth token, MetaMask connection, and all API calls.
 */
const API = (() => {
  const BASE = '/api';
  let token = localStorage.getItem('gf_token');
  let currentUser = JSON.parse(localStorage.getItem('gf_user') || 'null');

  const PLATFORM_WALLET = '0x8417C9a00249Da8e4ff7414c5992C08511c28328';
  const USDT_BEP20 = '0x55d398326f99059fF775485246999027B3197955';

  function headers() {
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  async function request(method, path, body = null) {
    const opts = { method, headers: headers() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  // ── MetaMask Auth ──────────────────────────────────

  function isMobile() {
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
  }

  function openInMetaMaskBrowser() {
    const url = window.location.host + window.location.pathname + window.location.search;
    window.location.href = 'https://metamask.app.link/dapp/' + url;
  }

  async function connectMetaMask() {
    if (typeof window.ethereum === 'undefined') {
      if (isMobile()) {
        openInMetaMaskBrowser();
        return;
      }
      throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
    }

    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const wallet = accounts[0];

    // 1) Get nonce
    const { message } = await request('GET', `/auth/nonce?wallet=${wallet}`);

    // 2) Sign the nonce message
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, wallet],
    });

    // 3) Verify and get JWT
    const data = await request('POST', '/auth/verify', { wallet, signature });

    token = data.token;
    currentUser = data.user;
    localStorage.setItem('gf_token', token);
    localStorage.setItem('gf_user', JSON.stringify(currentUser));

    return data;
  }

  function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem('gf_token');
    localStorage.removeItem('gf_user');
  }

  function isLoggedIn() { return !!token; }
  function getUser() { return currentUser; }
  function isAdmin() { return currentUser?.role === 'admin'; }

  // ── MetaMask Payment Helper ──────────────────────────
  async function ensureBSC() {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (chainId !== '0x38') {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x38' }],
        });
      } catch (switchErr) {
        // Chain not added to MetaMask — add it with a reliable RPC
        if (switchErr.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x38',
              chainName: 'BNB Smart Chain',
              nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
              rpcUrls: ['https://bsc-dataseed.binance.org/'],
              blockExplorerUrls: ['https://bscscan.com'],
            }],
          });
        } else {
          throw switchErr;
        }
      }
    }
  }

  /**
   * Send USDT BEP20 payment via MetaMask.
   * Returns the tx_hash on success.
   */
  async function sendPayment(amountUSDT) {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask not detected. Please install MetaMask.');
    }

    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const from = accounts[0];

    await ensureBSC();

    // Encode ERC20 transfer(address,uint256)
    const amountWei = '0x' + (BigInt(Math.round(amountUSDT * 1e18))).toString(16);
    const transferData = '0xa9059cbb'
      + PLATFORM_WALLET.slice(2).toLowerCase().padStart(64, '0')
      + amountWei.slice(2).padStart(64, '0');

    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from,
        to: USDT_BEP20,
        data: transferData,
        value: '0x0',
      }],
    });

    return txHash;
  }

  // ── Client API ─────────────────────────────────────

  const client = {
    farm:          () => request('GET', '/client/farm'),
    collectEggs:   () => request('POST', '/client/collect-eggs'),
    feedPrice:     () => request('GET', '/client/feed-price'),
    buyFeed:       (qty, txHash) => request('POST', '/client/buy-feed', { quantity: qty, tx_hash: txHash }),
    eggPrice:      () => request('GET', '/client/egg-price'),
    buyEggs:       (qty, txHash) => request('POST', '/client/buy-eggs', { quantity: qty, tx_hash: txHash }),
    buyChicken:    (speciesId, txHash) => request('POST', '/client/buy-chicken', { species_id: speciesId, tx_hash: txHash }),
    withdraw:      (amount) => request('POST', '/client/withdraw', { amount }),
    species:       () => request('GET', '/client/species'),
    ledger:        (page) => request('GET', `/client/ledger?page=${page || 1}`),
    purchases:     (page) => request('GET', `/client/purchases?page=${page || 1}`),
    eggsForIncubation: () => request('GET', '/client/eggs-for-incubation'),
    incubateEgg:   (eggId) => request('POST', '/client/incubate-egg', { egg_id: eggId }),
    incubateAll:   () => request('POST', '/client/incubate-all-eggs'),
    feedChick:     (chickId, amount) => request('POST', '/client/feed-chick', { chick_id: chickId, amount }),
    feedAllChicks: () => request('POST', '/client/feed-all-chicks'),
    renameChicken: (id, name) => request('PATCH', `/client/chicken/${id}/name`, { name }),
    deadChickens:  (page) => request('GET', `/client/dead-chickens?page=${page || 1}`),
    eggHistory:    (page) => request('GET', `/client/egg-history?page=${page || 1}`),
    chickHistory:  (page) => request('GET', `/client/chick-history?page=${page || 1}`),
  };

  // ── Admin API ──────────────────────────────────────

  const admin = {
    getEconomy:       () => request('GET', '/admin/economy'),
    setEconomy:       (key, value) => request('PUT', `/admin/economy/${key}`, { value }),
    getEconomyHistory:() => request('GET', '/admin/economy/history'),
    getWithdrawals:   (status, page) => request('GET', `/admin/withdrawals?status=${status || 'pending'}&page=${page || 1}`),
    completeWithdrawal:(id, txHash) => request('PUT', `/admin/withdrawals/${id}/complete`, { tx_hash: txHash }),
    cancelWithdrawal: (id, note) => request('PUT', `/admin/withdrawals/${id}/cancel`, { note }),
    getUsers:         (page, search) => request('GET', `/admin/users?page=${page || 1}${search ? '&search=' + encodeURIComponent(search) : ''}`),
    banUser:          (id, banned) => request('PUT', `/admin/users/${id}/ban`, { banned }),
    giveBonus:        (id, data) => request('POST', `/admin/users/${id}/bonus`, data),
    getAlerts:        () => request('GET', '/admin/alerts'),
    getDashboard:     () => request('GET', '/admin/dashboard'),
    getPurchaseStats: () => request('GET', '/admin/purchases/stats'),
    getWithdrawalStats:() => request('GET', '/admin/withdrawals/stats'),
    getSpecies:       () => request('GET', '/admin/species'),
    createSpecies:    (data) => request('POST', '/admin/species', data),
    updateSpecies:    (id, data) => request('PUT', `/admin/species/${id}`, data),
    deleteSpecies:    (id) => request('DELETE', `/admin/species/${id}`),
  };

  async function adminLogin(username, password) {
    const data = await request('POST', '/auth/admin-login', { username, password });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('gf_token', token);
    localStorage.setItem('gf_user', JSON.stringify(currentUser));
    return data;
  }

  return { connectMetaMask, adminLogin, logout, isLoggedIn, getUser, isAdmin, sendPayment, ensureBSC, client, admin };
})();
