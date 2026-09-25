import { v4 as uuidv4 } from 'uuid';
import store from '../store/memStore.js';
import { createClient } from '../models/client.js';

const COLLECTION = 'clients';

export function listClients() {
  return store.list(COLLECTION);
}

export function getClient(id) {
  return store.get(COLLECTION, id);
}

export function createClientRecord(body) {
  const id = uuidv4();
  const client = createClient({ ...body, id });
  store.set(COLLECTION, id, client);
  return client;
}

export function updateClient(id, body) {
  const existing = store.get(COLLECTION, id);
  if (!existing) return null;

  const updated = createClient({
    ...existing,
    ...body,
    id,
    createdAt: existing.createdAt,
  });

  store.set(COLLECTION, id, updated);
  return updated;
}

export function deleteClient(id) {
  return store.delete(COLLECTION, id);
}
