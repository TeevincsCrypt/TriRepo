import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';

import { apiPrefix } from './config.js';
import requestLogger from './middleware/requestLogger.js';
import errorHandler from './middleware/errorHandler.js';
import authMiddleware from './middleware/auth.js';

import invoiceRoutes from './routes/invoices.js';
import clientRoutes from './routes/clients.js';
import healthRoutes from './routes/health.js';

const app = express();

// Security
app.use(helmet());
app.use(cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined'));
app.use(requestLogger);

// Health (no auth)
app.use('/', healthRoutes);

// Auth gate for API routes
app.use(apiPrefix, authMiddleware);

// API routes
app.use(`${apiPrefix}/invoices`, invoiceRoutes);
app.use(`${apiPrefix}/clients`, clientRoutes);

// ── BUMP call site #4 — PATCHED ───────────────────────────────────────────
// app.del() was removed in Express 5 (TypeError: app.del is not a function).
// app.delete() is the correct method in both Express 4 and Express 5.
app.delete('/deprecated/ping', (req, res) => {
  res.status(410).json({ error: 'GONE', message: 'This endpoint was removed' });
});

// ── BUMP call site #5 — PATCHED ───────────────────────────────────────────
// Bare '*' wildcard throws PathError in Express 5 (path-to-regexp v6+).
// '/*' is the forward-compatible catch-all that works in Express 4 and 5.
app.use('/*', (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

export default app;
