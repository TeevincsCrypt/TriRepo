import { v4 as uuidv4 } from 'uuid';
import store from '../store/memStore.js';
import { createInvoice, VALID_STATUSES } from '../models/invoice.js';
import { calcDueDate, isPast } from './dateService.js';
import { currency as defaultCurrency, maxInvoiceItems } from '../config.js';

const COLLECTION = 'invoices';

export function listInvoices(filters = {}) {
  let invoices = store.list(COLLECTION);

  if (filters.clientId) {
    invoices = invoices.filter((inv) => inv.clientId === filters.clientId);
  }
  if (filters.status) {
    invoices = invoices.filter((inv) => inv.status === filters.status);
  }

  // Auto-mark overdue
  invoices = invoices.map((inv) => {
    if (inv.status === 'sent' && isPast(inv.dueAt)) {
      const updated = { ...inv, status: 'overdue', updatedAt: new Date().toISOString() };
      store.set(COLLECTION, inv.id, updated);
      return updated;
    }
    return inv;
  });

  return invoices;
}

export function getInvoice(id) {
  return store.get(COLLECTION, id);
}

export function createInvoiceRecord(body) {
  if (body.items && body.items.length > maxInvoiceItems) {
    const err = new Error(`Invoice may not have more than ${maxInvoiceItems} items`);
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const id = uuidv4();
  const issuedAt = body.issuedAt || new Date().toISOString().slice(0, 10);

  // calcDueDate will throw TypeError if body.paymentTerms is undefined/null
  const dueAt = body.dueAt || calcDueDate(issuedAt, body.paymentTerms);

  const invoice = createInvoice(
    {
      ...body,
      id,
      issuedAt,
      dueAt,
    },
    defaultCurrency
  );

  store.set(COLLECTION, id, invoice);
  return invoice;
}

export function updateInvoice(id, body) {
  const existing = store.get(COLLECTION, id);
  if (!existing) return null;

  const updated = createInvoice(
    {
      ...existing,
      ...body,
      id,
      createdAt: existing.createdAt,
    },
    defaultCurrency
  );

  store.set(COLLECTION, id, updated);
  return updated;
}

export function deleteInvoice(id) {
  return store.delete(COLLECTION, id);
}

export function updateInvoiceStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) {
    const err = new Error(`Invalid status: "${status}". Must be one of: ${VALID_STATUSES.join(', ')}`);
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const existing = store.get(COLLECTION, id);
  if (!existing) return null;

  const updated = { ...existing, status, updatedAt: new Date().toISOString() };
  store.set(COLLECTION, id, updated);
  return updated;
}
