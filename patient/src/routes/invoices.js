import express from 'express';
import { body, param, query } from 'express-validator';
import validate from '../middleware/validate.js';
import * as svc from '../services/invoiceService.js';

const router = express.Router();

// ── BUMP call site #1 — PATCHED ────────────────────────────────────────────
// req.param() was removed in Express 5 ("TypeError: req.param is not a function").
// Replacement: check req.params, req.body, req.query in the same order Express 4 did.
// This is forward-compatible: works on Express 4 and Express 5.
function legacyLookupParam(req, name) {
  return (req.params && req.params[name] !== undefined)
    ? req.params[name]
    : (req.body && req.body[name] !== undefined)
      ? req.body[name]
      : (req.query && req.query[name] !== undefined)
        ? req.query[name]
        : undefined;
}

// ── List invoices ──────────────────────────────────────────────────────────
router.get(
  '/',
  [
    query('clientId').optional().isUUID(),
    query('status').optional().isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  ],
  validate,
  (req, res) => {
    const invoices = svc.listInvoices(req.query);
    res.json({ data: invoices, count: invoices.length });
  }
);

// ── Get one invoice ────────────────────────────────────────────────────────
router.get(
  '/:id',
  [param('id').isUUID()],
  validate,
  (req, res) => {
    // BUMP call site #2: req.param() called at runtime — removed in Express 5
    const id = legacyLookupParam(req, 'id');
    const invoice = svc.getInvoice(id);
    if (!invoice) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found' });
    }
    res.json({ data: invoice });
  }
);

// ── Create invoice ─────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('clientId').isUUID(),
    body('invoiceNumber').isString().notEmpty(),
    body('issuedAt').optional().isISO8601(),
    body('items').isArray({ min: 1 }),
    body('items.*.description').isString().notEmpty(),
    body('items.*.quantity').isFloat({ min: 0.01 }),
    body('items.*.unitPrice').isFloat({ min: 0 }),
    body('taxRate').optional().isFloat({ min: 0, max: 1 }),
    // NOTE: paymentTerms is intentionally NOT validated here — triggers the crash bug
  ],
  validate,
  (req, res, next) => {
    try {
      const invoice = svc.createInvoiceRecord(req.body);
      // BUMP call site #3: res.json(body, status) two-arg form removed in Express 5.
      // Express 4 silently accepts this and sets status 201.
      // Express 5 ignores the second arg (status is set to 200 — wrong), or throws
      // depending on build. Confirmed removed: migration guide §res.json.
      res.json({ data: invoice }, 201);
    } catch (err) {
      next(err);
    }
  }
);

// ── Update invoice ─────────────────────────────────────────────────────────
router.put(
  '/:id',
  [
    param('id').isUUID(),
    body('status').optional().isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
    body('items').optional().isArray({ min: 1 }),
  ],
  validate,
  (req, res, next) => {
    try {
      const invoice = svc.updateInvoice(req.params.id, req.body);
      if (!invoice) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found' });
      }
      res.json({ data: invoice });
    } catch (err) {
      next(err);
    }
  }
);

// ── Update invoice status ──────────────────────────────────────────────────
router.patch(
  '/:id/status',
  [
    param('id').isUUID(),
    body('status').isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  ],
  validate,
  (req, res, next) => {
    try {
      const invoice = svc.updateInvoiceStatus(req.params.id, req.body.status);
      if (!invoice) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found' });
      }
      res.json({ data: invoice });
    } catch (err) {
      next(err);
    }
  }
);

// ── Delete invoice ─────────────────────────────────────────────────────────
router.delete(
  '/:id',
  [param('id').isUUID()],
  validate,
  (req, res) => {
    const deleted = svc.deleteInvoice(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found' });
    }
    res.status(204).end();
  }
);

export default router;
