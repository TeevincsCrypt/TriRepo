import { apiKey } from '../config.js';

/**
 * API key authentication middleware.
 * Skipped when API_KEY env var is empty (development mode).
 */
function authMiddleware(req, res, next) {
  // No API key configured → skip auth (development / test)
  if (!apiKey) {
    return next();
  }

  const provided = req.headers['x-api-key'];

  if (!provided || provided !== apiKey) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid API key',
    });
  }

  next();
}

export default authMiddleware;
