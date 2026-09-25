/**
 * Global error handler.
 * Express requires the 4-argument signature even if `next` is unused.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred';

  if (status >= 500) {
    console.error('[ERROR]', err);
  }

  res.status(status).json({ error: code, message });
}

export default errorHandler;
