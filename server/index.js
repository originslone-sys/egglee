require('dotenv').config();

console.log('[BOOT] Starting server...');
console.log('[BOOT] NODE_ENV:', process.env.NODE_ENV);
console.log('[BOOT] PORT:', process.env.PORT);
console.log('[BOOT] DB_NAME:', process.env.DB_NAME ? 'SET' : 'NOT SET');
console.log('[BOOT] DB_USER:', process.env.DB_USER ? 'SET' : 'NOT SET');
console.log('[BOOT] DB_PASSWORD:', process.env.DB_PASSWORD ? 'SET' : 'NOT SET');
console.log('[BOOT] CLOUD_SQL_CONNECTION_NAME:', process.env.CLOUD_SQL_CONNECTION_NAME ? 'SET' : 'NOT SET');
console.log('[BOOT] JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cron = require('node-cron');
const fs = require('fs');

console.log('[BOOT] Core modules loaded');

// Check that frontend files exist
const frontendDir = path.join(__dirname, '..', 'public');
const indexPath = path.join(frontendDir, 'index.html');
console.log('[BOOT] Frontend dir:', frontendDir);
console.log('[BOOT] index.html exists:', fs.existsSync(indexPath));
try {
  const files = fs.readdirSync(frontendDir).filter(f => !f.startsWith('node_modules') && !f.startsWith('.'));
  console.log('[BOOT] Root files:', files.join(', '));
} catch (e) {
  console.error('[BOOT] Cannot list frontend dir:', e.message);
}

let authRoutes, clientRoutes, adminRoutes, runProductionCycle, scanDeposits, scanPurchases;

try {
  authRoutes = require('./routes/auth');
  console.log('[BOOT] auth routes loaded');
} catch (e) {
  console.error('[BOOT] FAILED to load auth routes:', e.message);
  authRoutes = require('express').Router();
}

try {
  clientRoutes = require('./routes/client');
  console.log('[BOOT] client routes loaded');
} catch (e) {
  console.error('[BOOT] FAILED to load client routes:', e.message);
  clientRoutes = require('express').Router();
}

try {
  adminRoutes = require('./routes/admin');
  console.log('[BOOT] admin routes loaded');
} catch (e) {
  console.error('[BOOT] FAILED to load admin routes:', e.message);
  adminRoutes = require('express').Router();
}

try {
  ({ runProductionCycle } = require('./jobs/production'));
  ({ scanDeposits } = require('./jobs/depositMonitor'));
  ({ scanPurchases } = require('./jobs/purchaseMonitor'));
  console.log('[BOOT] jobs loaded');
} catch (e) {
  console.error('[BOOT] FAILED to load jobs:', e.message);
  runProductionCycle = async () => ({ skipped: true });
  scanDeposits = async () => ({ skipped: true, found: 0, credited: 0 });
  scanPurchases = async () => ({ checked: 0, confirmed: 0, failed: 0 });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors());

app.use(express.json());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/admin', adminRoutes);

// Serve static frontend files from public/
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check with debug info
app.get('/api/health', (req, res) => {
  const frontendDir = path.join(__dirname, '..', 'public');
  const indexExists = fs.existsSync(path.join(frontendDir, 'index.html'));
  let rootFiles = [];
  try {
    rootFiles = fs.readdirSync(frontendDir).filter(f => !f.startsWith('node_modules') && !f.startsWith('.'));
  } catch (e) { /* ignore */ }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    port: process.env.PORT,
    indexHtmlExists: indexExists,
    frontendDir,
    rootFiles,
    dbConfigured: !!(process.env.DB_NAME && process.env.DB_USER),
    cloudSql: !!process.env.CLOUD_SQL_CONNECTION_NAME,
  });
});

// Catch-all: serve index.html for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// Production cycle cron — every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  try {
    const result = await runProductionCycle();
    console.log(`[CRON] Production cycle:`, result);
  } catch (err) {
    console.error('[CRON] Production cycle error:', err.message);
  }
});

// Deposit monitor cron — every 2 minutes
cron.schedule('*/2 * * * *', async () => {
  try {
    const result = await scanDeposits();
    if (result.found > 0 || result.credited > 0) {
      console.log(`[CRON] Deposit scan:`, result);
    }
  } catch (err) {
    console.error('[CRON] Deposit scan error:', err.message);
  }
});

// Purchase monitor cron — every 2 minutes
cron.schedule('*/2 * * * *', async () => {
  try {
    const result = await scanPurchases();
    if (result.confirmed > 0 || result.failed > 0) {
      console.log(`[CRON] Purchase scan:`, result);
    }
  } catch (err) {
    console.error('[CRON] Purchase scan error:', err.message);
  }
});

app.listen(PORT, () => {
  console.log(`[SERVER] Egglee running on port ${PORT}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('[SERVER] Server is ready to accept requests');
});

module.exports = app;
