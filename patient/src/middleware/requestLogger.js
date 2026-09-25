/**
 * Attaches a request-start timestamp and logs request duration on finish.
 */
function requestLogger(req, res, next) {
  req._startAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - req._startAt;
    const durationMs = Number(durationNs) / 1e6;
    console.log(
      `[REQ] ${req.method} ${req.originalUrl} → ${res.statusCode} (${durationMs.toFixed(2)}ms)`
    );
  });

  next();
}

export default requestLogger;
