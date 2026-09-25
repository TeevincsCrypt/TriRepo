export function createClient(data) {
  const now = new Date().toISOString();
  return {
    id: data.id,
    name: data.name,
    email: data.email || '',
    phone: data.phone || '',
    address: data.address || '',
    taxId: data.taxId || '',
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
}
