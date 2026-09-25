import { describe, it, expect } from 'vitest';
import { addDays, calcDueDate, isPast, daysBetween } from '../src/services/dateService.js';

describe('dateService', () => {
  describe('addDays', () => {
    it('adds 30 days to a date', () => {
      expect(addDays('2024-03-01', 30)).toBe('2024-03-31');
    });

    it('handles month roll-over', () => {
      expect(addDays('2024-01-31', 1)).toBe('2024-02-01');
    });

    it('handles leap year', () => {
      expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    });

    it('adds 0 days (same day)', () => {
      expect(addDays('2024-06-15', 0)).toBe('2024-06-15');
    });
  });

  describe('calcDueDate', () => {
    it('calculates net30', () => {
      expect(calcDueDate('2024-03-01', 'net30')).toBe('2024-03-31');
    });

    it('calculates net60', () => {
      expect(calcDueDate('2024-03-01', 'net60')).toBe('2024-04-30');
    });

    it('calculates net90', () => {
      expect(calcDueDate('2024-03-01', 'net90')).toBe('2024-05-30');
    });

    it('calculates due_on_receipt (same day)', () => {
      expect(calcDueDate('2024-03-01', 'due_on_receipt')).toBe('2024-03-01');
    });

    it('is case-insensitive for terms', () => {
      expect(calcDueDate('2024-03-01', 'NET30')).toBe('2024-03-31');
    });

    it('throws 400 for unknown terms', () => {
      expect(() => calcDueDate('2024-03-01', 'net45')).toThrow();
    });

    // CRASH reproduction: terms is undefined (omitted from request body).
    // Before fix: throws TypeError (unhandled crash).
    // After fix: throws a structured Error with status 400, NOT a TypeError.
    it('throws structured 400 error (not TypeError) when terms is undefined — CRASH-001', () => {
      let thrown;
      try {
        calcDueDate('2024-03-01', undefined);
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeDefined();
      expect(thrown).not.toBeInstanceOf(TypeError);
      expect(thrown.status).toBe(400);
    });
  });

  describe('isPast', () => {
    it('returns true for a past date', () => {
      expect(isPast('2000-01-01')).toBe(true);
    });

    it('returns false for a future date', () => {
      expect(isPast('2999-12-31')).toBe(false);
    });
  });

  describe('daysBetween', () => {
    it('calculates 30 days between dates', () => {
      expect(daysBetween('2024-03-01', '2024-03-31')).toBe(30);
    });

    it('returns negative when end is before start', () => {
      expect(daysBetween('2024-03-31', '2024-03-01')).toBe(-30);
    });
  });
});
