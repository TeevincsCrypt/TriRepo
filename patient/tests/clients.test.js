import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import store from '../src/store/memStore.js';

describe('Clients API', () => {
  beforeEach(() => {
    store.clear();
  });

  describe('POST /api/v1/clients', () => {
    it('creates a client', async () => {
      const res = await request(app)
        .post('/api/v1/clients')
        .send({ name: 'Beta Ltd', email: 'contact@beta.example' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Beta Ltd');
      expect(res.body.data.id).toBeTruthy();
    });

    it('returns 400 when email is invalid', async () => {
      const res = await request(app)
        .post('/api/v1/clients')
        .send({ name: 'Bad Client', email: 'not-an-email' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/v1/clients')
        .send({ email: 'ok@example.com' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/clients', () => {
    it('returns all clients', async () => {
      await request(app)
        .post('/api/v1/clients')
        .send({ name: 'Gamma Inc', email: 'g@gamma.example' });
      await request(app)
        .post('/api/v1/clients')
        .send({ name: 'Delta LLC', email: 'd@delta.example' });

      const res = await request(app).get('/api/v1/clients');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
    });
  });

  describe('PUT /api/v1/clients/:id', () => {
    it('updates a client name', async () => {
      const create = await request(app)
        .post('/api/v1/clients')
        .send({ name: 'Old Name', email: 'old@example.com' });

      const id = create.body.data.id;
      const update = await request(app)
        .put(`/api/v1/clients/${id}`)
        .send({ name: 'New Name' });

      expect(update.status).toBe(200);
      expect(update.body.data.name).toBe('New Name');
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app)
        .put('/api/v1/clients/00000000-0000-0000-0000-000000000000')
        .send({ name: 'X' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/clients/:id', () => {
    it('deletes a client', async () => {
      const create = await request(app)
        .post('/api/v1/clients')
        .send({ name: 'To Delete', email: 'del@example.com' });

      const id = create.body.data.id;
      const del = await request(app).delete(`/api/v1/clients/${id}`);
      expect(del.status).toBe(204);

      const get = await request(app).get(`/api/v1/clients/${id}`);
      expect(get.status).toBe(404);
    });
  });
});
