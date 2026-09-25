import express from 'express';
import { apiPrefix } from '../config.js';

const router = express.Router();

// ── Liveness probe ─────────────────────────────────────────────────────────
router.get('/healthz', (req, res) => {
  // Express 4: res.status(200).json() — BUMP call site #7
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// ── Extended status ────────────────────────────────────────────────────────
router.get(`${apiPrefix}/status`, (req, res) => {
  res.json({
    status: 'ok',
    version: process.env.npm_package_version || '2.3.1',
    node: process.version,
    uptime: process.uptime(),
    memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  });
});

export default router;
