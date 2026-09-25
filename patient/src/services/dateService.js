/**
 * Date utility service for invoice due-date calculations.
 *
 * All public functions accept and return ISO date strings (YYYY-MM-DD).
 */

/**
 * Add a number of days to an ISO date string.
 * @param {string} isoDate - e.g. '2024-03-15'
 * @param {number} days
 * @returns {string} ISO date string
 */
export function addDays(isoDate, days) {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Calculate the due date for an invoice given its issue date and payment terms.
 *
 * @param {string} issuedAt - ISO date string
 * @param {string} terms    - payment terms string: 'net30', 'net60', 'net90', 'due_on_receipt'
 * @returns {string} ISO due date string
 */
export function calcDueDate(issuedAt, terms) {
  const termDays = {
    net30: 30,
    net60: 60,
    net90: 90,
    due_on_receipt: 0,
  };

  if (terms == null) {
    const err = new Error('Payment terms are required');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const normalised = terms.toLowerCase();
  const days = termDays[normalised];

  if (days === undefined) {
    const err = new Error(`Unknown payment terms: "${terms}"`);
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  return addDays(issuedAt, days);
}

/**
 * Return true if the given ISO date is strictly before today (UTC).
 * @param {string} isoDate
 * @returns {boolean}
 */
export function isPast(isoDate) {
  const today = new Date().toISOString().slice(0, 10);
  return isoDate < today;
}

/**
 * Return the number of days between two ISO dates (end - start).
 * Negative if end is before start.
 * @param {string} start
 * @param {string} end
 * @returns {number}
 */
export function daysBetween(start, end) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / msPerDay
  );
}
