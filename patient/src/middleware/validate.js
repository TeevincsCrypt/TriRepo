import { validationResult } from 'express-validator';

/**
 * Runs express-validator checks and short-circuits with 400 if any fail.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: errors.array(),
    });
  }
  next();
}

export default validate;
