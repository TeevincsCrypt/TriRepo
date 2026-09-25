import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import store from '../src/store/memStore.js';

describe('Invoices API', () => {
  let clientId;

  beforeEach(async () => {
    store.clear();
    // Seed one client
    const res = await request(app)
      .post('/api/v1/clients')
      .send({ name: 'Acme Corp', email: 'billing@acme.example' });
    clientId = res.body.data.id;
  });

  describe('POST /api/v1/invoices', () => {
    it('creates an invoice with explicit dueAt', async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .send({
          clientId,
          invoiceNumber: 'INV-001',
          issuedAt: '2024-03-01',
          dueAt: '2024-03-31',
          items: [{ description: 'Consulting', quantity: 10, unitPrice: 150 }],
          taxRate: 0.1,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.total).toBe(1650);
      expect(res.body.data.status).toBe('draft');
    });

    it('creates an invoice using paymentTerms net30', async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .send({
          clientId,
          invoiceNumber: 'INV-002',
          issuedAt: '2024-03-01',
          paymentTerms: 'net30',
          items: [{ description: 'Design', quantity: 5, unitPrice: 200 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.dueAt).toBe('2024-03-31');
    });

    // CRASH reproduction: exact payload from CRASH.txt — no paymentTerms, no dueAt.
    // Before fix: 500 Internal Server Error (TypeError).
    // After fix:  400 Bad Request (structured VALIDATION_ERROR).
    it('returns 400 (not 500) when paymentTerms is omitted and dueAt is absent — CRASH-001', async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .send({
          clientId,
          invoiceNumber: 'INV-CRASH-001',
          issuedAt: '2024-03-01',
          items: [{ description: 'Crash test', quantity: 1, unitPrice: 100 }],
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 when items is missing', async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .send({
          clientId,
          invoiceNumber: 'INV-003',
          issuedAt: '2024-03-01',
          dueAt: '2024-03-31',
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 when clientId is not a UUID', async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .send({
          clientId: 'not-a-uuid',
          invoiceNumber: 'INV-004',
          issuedAt: '2024-03-01',
          dueAt: '2024-03-31',
          items: [{ description: 'Test', quantity: 1, unitPrice: 10 }],
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/invoices', () => {
    it('returns an empty list when no invoices exist', async () => {
      const res = await request(app).get('/api/v1/invoices');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.count).toBe(0);
    });

    it('filters by status', async () => {
      await request(app)
        .post('/api/v1/invoices')
        .send({
          clientId,
          invoiceNumber: 'INV-010',
          issuedAt: '2024-03-01',
          dueAt: '2024-03-31',
          items: [{ description: 'X', quantity: 1, unitPrice: 100 }],
        });

      const draftRes = await request(app).get('/api/v1/invoices?status=draft');
      expect(draftRes.status).toBe(200);
      expect(draftRes.body.count).toBeGreaterThan(0);

      const paidRes = await request(app).get('/api/v1/invoices?status=paid');
      expect(paidRes.status).toBe(200);
      expect(paidRes.body.count).toBe(0);
    });
  });

  describe('GET /api/v1/invoices/:id', () => {
    it('returns 404 for unknown id', async () => {
      const res = await request(app).get(
        '/api/v1/invoices/00000000-0000-0000-0000-000000000000'
      );
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/invoices/:id', () => {
    it('deletes an existing invoice', async () => {
      const create = await request(app)
        .post('/api/v1/invoices')
        .send({
          clientId,
          invoiceNumber: 'INV-DEL',
          issuedAt: '2024-03-01',
          dueAt: '2024-03-31',
          items: [{ description: 'To delete', quantity: 1, unitPrice: 50 }],
        });

      const id = create.body.data.id;
      const del = await request(app).delete(`/api/v1/invoices/${id}`);
      expect(del.status).toBe(204);

      const get = await request(app).get(`/api/v1/invoices/${id}`);
      expect(get.status).toBe(404);
    });
  });
});
