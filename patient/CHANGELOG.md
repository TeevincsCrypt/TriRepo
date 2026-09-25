# Changelog

All notable changes to Vaultline are documented here.

## [2.3.1] - 2024-11-15

### Fixed
- Due-date calculation now handles leap years correctly
- Rate-limit headers no longer stripped by CORS middleware

## [2.3.0] - 2024-10-02

### Added
- `GET /api/v1/invoices/:id/pdf` endpoint (PDF export stub)
- `X-Request-Id` header on all responses

### Changed
- Migrated from v1 to v2 route prefix for all endpoints

## [2.2.0] - 2024-08-14

### Added
- Client management endpoints
- Bulk invoice status update

### Removed
- Deprecated `/ping` health endpoint (use `/healthz`)

## [2.1.0] - 2024-06-01

### Added
- API key authentication middleware
- morgan request logging

## [2.0.0] - 2024-03-10

### Breaking
- Renamed all routes from `/api/v1/` to `/api/v1/`
- `invoiceDate` field renamed to `issuedAt`

## [1.0.0] - 2023-12-01

Initial release.
