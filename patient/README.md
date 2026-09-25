# Vaultline

> Invoice management API for small businesses.

## Requirements

- Node.js >= 18.0.0
- npm >= 8

## Installation

```bash
npm install
```

## Configuration

Copy the example env file and edit as needed:

```bash
cp .env.example .env
```

Key environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `API_PREFIX` | `/api/v1` | Route prefix |
| `LOG_LEVEL` | `info` | Logging level (`debug`, `info`, `warn`, `error`) |
| `MAX_INVOICE_ITEMS` | `50` | Max line items per invoice |
| `INVOICE_CURRENCY` | `USD` | Default currency |

## Starting the Server

```bash
npm start
```

The server starts on **http://localhost:3000** by default.

## Running Tests

```bash
npm run test:unit
```

For integration tests:

```bash
npm run test:integration
```

## API Endpoints

### Invoices

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/invoices` | List all invoices |
| GET | `/api/v2/invoices/:id` | Get invoice by ID |
| POST | `/api/v2/invoices` | Create invoice |
| PUT | `/api/v2/invoices/:id` | Update invoice |
| DELETE | `/api/v2/invoices/:id` | Delete invoice |

### Clients

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v2/clients` | List all clients |
| GET | `/api/v2/clients/:id` | Get client by ID |
| POST | `/api/v2/clients` | Create client |
| PUT | `/api/v2/clients/:id` | Update client |
| DELETE | `/api/v2/clients/:id` | Delete client |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Health check |
| GET | `/api/v2/status` | Extended status |

## Project Structure

```
vaultline/
  src/
    index.js          entry point
    app.js            express app factory
    config.js         configuration loader
    middleware/
      auth.js         API key middleware
      errorHandler.js global error handler
      requestLogger.js request logging
      validate.js     validation helpers
    routes/
      invoices.js     invoice routes
      clients.js      client routes
      health.js       health routes
    services/
      invoiceService.js  invoice business logic
      clientService.js   client business logic
      dateService.js     date calculation utilities
    models/
      invoice.js      invoice model/schema
      client.js       client model/schema
    store/
      memStore.js     in-memory data store
  tests/
    invoices.test.js
    clients.test.js
    dateService.test.js
    middleware.test.js
  .env.example
  .gitignore
```

## Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid input |
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `CONFLICT` | 409 | Duplicate resource |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.
