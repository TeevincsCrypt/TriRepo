import express from 'express';
import { body, param } from 'express-validator';
import validate from '../middleware/validate.js';
import * as svc from '../services/clientService.js';

const router = express.Router();

// BUMP call site #6 — PATCHED: req.param() removed in Express 5.
// Replacement mirrors Express 4 lookup order: params → body → query.
function legacyLookupParam(req, name) {
  return (req.params && req.params[name] !== undefined)
    ? req.params[name]
    : (req.body && req.body[name] !== undefined)
      ? req.body[name]
      : (req.query && req.query[name] !== undefined)
        ? req.query[name]
        : undefined;
}

// ── List clients ───────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const clients = svc.listClients();
  res.json({ data: clients, count: clients.length });
});

// ── Get one client ─────────────────────────────────────────────────────────
router.get(
  '/:id',
  [param('id').isUUID()],
  validate,
  (req, res) => {
    // BUMP call site #6: req.param() at runtime — removed in Express 5
    const id = legacyLookupParam(req, 'id');
    const client = svc.getClient(id);
    if (!client) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Client not found' });
    }
    res.json({ data: client });
  }
);

// ── Create client ──────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('name').isString().notEmpty(),
    body('email').isEmail(),
    body('phone').optional().isString(),
    body('address').optional().isString(),
    body('taxId').optional().isString(),
  ],
  validate,
  (req, res) => {
    const client = svc.createClientRecord(req.body);
    // BUMP call site #7: res.json(body, status) two-arg form — removed in Express 5
    res.json({ data: client }, 201);
  }
);

// ── Update client ──────────────────────────────────────────────────────────
router.put(
  '/:id',
  [
    param('id').isUUID(),
    body('name').optional().isString().notEmpty(),
    body('email').optional().isEmail(),
  ],
  validate,
  (req, res) => {
    const client = svc.updateClient(req.params.id, req.body);
    if (!client) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Client not found' });
    }
    res.json({ data: client });
  }
);

// ── Delete client ──────────────────────────────────────────────────────────
// Express 4: router.delete() — BUMP call site #5
router.delete(
  '/:id',
  [param('id').isUUID()],
  validate,
  (req, res) => {
    const deleted = svc.deleteClient(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Client not found' });
    }
    // Express 4: res.sendStatus(204) — BUMP call site #6
    res.sendStatus(204);
  }
);

export default router;
