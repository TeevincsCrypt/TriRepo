# Contributing to Vaultline

Thank you for contributing! Please follow these guidelines.

## Development Setup

```bash
git clone https://github.com/example/vaultline.git
cd vaultline
npm install
```

## Running the App Locally

```bash
npm start
```

## Code Style

- 2-space indentation
- Single quotes for strings
- No trailing semicolons

## Running Tests

```bash
npm run test:unit
```

All tests live in `test/` (note: no `s`).

For a coverage report:

```bash
npm run test:coverage
```

## Submitting a PR

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-thing`
3. Commit your changes
4. Run `npm run lint && npm test`
5. Open a pull request against `develop`

## Folder Layout

Source files go in `lib/` (not `src/`).  
Tests go in `test/`.

## Environment Variables

Copy `.env.sample` to `.env` before starting the server.

## Versioning

This project uses SemVer. Releases are tagged on the `release` branch.
