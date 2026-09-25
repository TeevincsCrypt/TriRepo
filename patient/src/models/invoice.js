/**
 * Invoice model factory.
 *
 * @typedef {Object} InvoiceItem
 * @property {string} description
 * @property {number} quantity
 * @property {number} unitPrice
 *
 * @typedef {Object} Invoice
 * @property {string}  id
 * @property {string}  clientId
 * @property {string}  invoiceNumber
 * @property {string}  status  - 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
 * @property {string}  issuedAt   - ISO date string (YYYY-MM-DD)
 * @property {string}  dueAt      - ISO date string (YYYY-MM-DD)
 * @property {InvoiceItem[]} items
 * @property {number}  subtotal
 * @property {number}  taxRate    - decimal, e.g. 0.10 for 10%
 * @property {number}  tax
 * @property {number}  total
 * @property {string}  currency
 * @property {string}  notes
 * @property {string}  createdAt  - ISO datetime
 * @property {string}  updatedAt  - ISO datetime
 */

export const VALID_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];

function calculateTotals(items, taxRate) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  return { subtotal: Math.round(subtotal * 100) / 100, tax, total };
}

export function createInvoice(data, currency) {
  const now = new Date().toISOString();
  const items = data.items || [];
  const taxRate = typeof data.taxRate === 'number' ? data.taxRate : 0;
  const { subtotal, tax, total } = calculateTotals(items, taxRate);

  return {
    id: data.id,
    clientId: data.clientId,
    invoiceNumber: data.invoiceNumber,
    status: data.status || 'draft',
    issuedAt: data.issuedAt,
    dueAt: data.dueAt,
    items,
    subtotal,
    taxRate,
    tax,
    total,
    currency: data.currency || currency,
    notes: data.notes || '',
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
}

export { calculateTotals };
