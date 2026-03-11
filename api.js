/**
 * api.js — HTTP client layer for Galinha Farm
 * Handles auth token, MetaMask connection, and all API calls.
 */
const API = (() => {
  // Set window.GALINHA_API_URL before loading this script to point to an external backend.
  // Example: window.GALINHA_API_URL = 'https://galinha-farm-xyz.run.app/api';
  const BASE = window.GALINHA_API_URL || '/api';
  let token = localStorage.getItem('gf_token');
  let currentUser = JSON.parse(localStorage.getItem('gf_user') || 'null');

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

  async function connectMetaMask() {
    if (typeof window.ethereum === 'undefined') {
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

  // ── Client API ─────────────────────────────────────

  const client = {
    farm:          () => request('GET', '/client/farm'),
    collectEggs:   () => request('POST', '/client/collect-eggs'),
    buyFeed:       (qty) => request('POST', '/client/buy-feed', { quantity: qty }),
    toggleAutoFeed:() => request('POST', '/client/toggle-auto-feed'),
    buyChicken:    (speciesId) => request('POST', '/client/buy-chicken', { species_id: speciesId }),
    withdraw:      (amount) => request('POST', '/client/withdraw', { amount }),
    species:       () => request('GET', '/client/species'),
    ledger:        (page) => request('GET', `/client/ledger?page=${page || 1}`),
    depositAddress:() => request('GET', '/client/deposit-address'),
    deposits:      (page) => request('GET', `/client/deposits?page=${page || 1}`),
    fertileEggs:   () => request('GET', '/client/fertile-eggs'),
    incubateEgg:   (eggId) => request('POST', '/client/incubate-egg', { egg_id: eggId }),
    feedChick:     (chickId, amount) => request('POST', '/client/feed-chick', { chick_id: chickId, amount }),
    deadChickens:  (page) => request('GET', `/client/dead-chickens?page=${page || 1}`),
  };

  // ── Admin API ──────────────────────────────────────

  const admin = {
    getEconomy:       () => request('GET', '/admin/economy'),
    setEconomy:       (key, value) => request('PUT', `/admin/economy/${key}`, { value }),
    getEconomyHistory:() => request('GET', '/admin/economy/history'),
    getWithdrawals:   (status, page) => request('GET', `/admin/withdrawals?status=${status || 'pending'}&page=${page || 1}`),
    processWithdrawal:(id) => request('PUT', `/admin/withdrawals/${id}/process`),
    completeWithdrawal:(id, txHash) => request('PUT', `/admin/withdrawals/${id}/complete`, { tx_hash: txHash }),
    rejectWithdrawal: (id, note) => request('PUT', `/admin/withdrawals/${id}/reject`, { note }),
    getUsers:         (page) => request('GET', `/admin/users?page=${page || 1}`),
    banUser:          (id, banned) => request('PUT', `/admin/users/${id}/ban`, { banned }),
    getAlerts:        () => request('GET', '/admin/alerts'),
    getDeposits:      (status, page) => request('GET', `/admin/deposits?status=${status || 'all'}&page=${page || 1}`),
  };

  // ── Marketplace API ────────────────────────────────

  const marketplace = {
    listings:     (type, page, sort) => request('GET', `/marketplace/listings?type=${type || 'egg'}&page=${page || 1}&sort=${sort || 'price_asc'}`),
    myOrders:     (status) => request('GET', `/marketplace/my-orders${status ? '?status=' + status : ''}`),
    myFee:        () => request('GET', '/marketplace/my-fee'),
    listEgg:      (price, qty) => request('POST', '/marketplace/list-egg', { price, quantity: qty }),
    listChicken:  (chickenId, price) => request('POST', '/marketplace/list-chicken', { chicken_id: chickenId, price }),
    buy:          (orderId) => request('POST', `/marketplace/buy/${orderId}`),
    cancel:       (orderId) => request('POST', `/marketplace/cancel/${orderId}`),
  };

  return { connectMetaMask, logout, isLoggedIn, getUser, isAdmin, client, admin, marketplace };
})();
