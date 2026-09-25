// crash-trigger.mjs — triggers the CRASH bug and captures the real stack trace
import app from './src/app.js';
import http from 'http';

const server = http.createServer(app);

function post(port, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

server.listen(3002, async () => {
  try {
    // Step 1: Create a real client
    const clientRes = await post(3002, '/api/v1/clients', {
      name: 'Crash Corp',
      email: 'crash@example.com',
    });
    console.log('Client created:', clientRes.status, clientRes.body.data.id);
    const clientId = clientRes.body.data.id;

    // Step 2: POST an invoice WITHOUT paymentTerms AND without dueAt
    // This calls calcDueDate(issuedAt, undefined) → terms.toLowerCase() → TypeError
    const invoiceRes = await post(3002, '/api/v1/invoices', {
      clientId,
      invoiceNumber: 'INV-CRASH-001',
      issuedAt: '2024-03-01',
      items: [{ description: 'Crash test', quantity: 1, unitPrice: 100 }],
      // dueAt: intentionally omitted
      // paymentTerms: intentionally omitted — triggers the bug
    });
    console.log('Invoice response status:', invoiceRes.status);
    console.log('Invoice response body:', JSON.stringify(invoiceRes.body, null, 2));

  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    server.close();
  }
});
