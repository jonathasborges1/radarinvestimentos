import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatCurrency,
  formatNumber,
  displayValue,
} from '../../../utils/formatting';

describe('formatDate', () => {
  it('should format an ISO date string to dd/mm/aaaa', () => {
    expect(formatDate('2030-07-15T00:00:00')).toBe('15/07/2030');
  });

  it('should format a date-only ISO string', () => {
    expect(formatDate('2024-01-01')).toBe('01/01/2024');
  });

  it('should format a date with timezone offset correctly using UTC', () => {
    expect(formatDate('2025-12-31T00:00:00Z')).toBe('31/12/2025');
  });

  it('should return "—" for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('should return "—" for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  it('should return "—" for empty string', () => {
    expect(formatDate('')).toBe('—');
  });

  it('should return "—" for an invalid date string', () => {
    expect(formatDate('not-a-date')).toBe('—');
  });

  it('should handle leap year dates', () => {
    expect(formatDate('2024-02-29')).toBe('29/02/2024');
  });
});

describe('formatCurrency', () => {
  it('should format a positive value as BRL currency', () => {
    const result = formatCurrency(844.29);
    // Intl may use non-breaking space; normalise for assertion
    const normalised = result.replace(/\s/g, ' ');
    expect(normalised).toBe('R$ 844,29');
  });

  it('should format zero', () => {
    const result = formatCurrency(0);
    const normalised = result.replace(/\s/g, ' ');
    expect(normalised).toBe('R$ 0,00');
  });

  it('should format a large value with thousands separator', () => {
    const result = formatCurrency(1234567.89);
    const normalised = result.replace(/\s/g, ' ');
    expect(normalised).toBe('R$ 1.234.567,89');
  });

  it('should format a negative value', () => {
    const result = formatCurrency(-100.5);
    const normalised = result.replace(/\s/g, ' ');
    expect(normalised).toContain('R$');
    expect(normalised).toContain('100,50');
  });

  it('should return "—" for null', () => {
    expect(formatCurrency(null)).toBe('—');
  });

  it('should return "—" for undefined', () => {
    expect(formatCurrency(undefined)).toBe('—');
  });

  it('should return "—" for NaN', () => {
    expect(formatCurrency(NaN)).toBe('—');
  });

  it('should return "—" for Infinity', () => {
    expect(formatCurrency(Infinity)).toBe('—');
  });
});

describe('formatNumber', () => {
  it('should format a number with Brazilian thousands separator', () => {
    expect(formatNumber(1541)).toBe('1.541');
  });

  it('should format zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('should format a decimal number', () => {
    expect(formatNumber(1234.56)).toBe('1.234,56');
  });

  it('should format a large number', () => {
    expect(formatNumber(1000000)).toBe('1.000.000');
  });

  it('should return "—" for null', () => {
    expect(formatNumber(null)).toBe('—');
  });

  it('should return "—" for undefined', () => {
    expect(formatNumber(undefined)).toBe('—');
  });

  it('should return "—" for NaN', () => {
    expect(formatNumber(NaN)).toBe('—');
  });

  it('should return "—" for -Infinity', () => {
    expect(formatNumber(-Infinity)).toBe('—');
  });
});

describe('displayValue', () => {
  it('should return "—" for null', () => {
    expect(displayValue(null)).toBe('—');
  });

  it('should return "—" for undefined', () => {
    expect(displayValue(undefined)).toBe('—');
  });

  it('should return "—" for empty string', () => {
    expect(displayValue('')).toBe('—');
  });

  it('should return the string representation for a non-empty string', () => {
    expect(displayValue('hello')).toBe('hello');
  });

  it('should return the string representation for a number', () => {
    expect(displayValue(42)).toBe('42');
  });

  it('should return the string representation for zero', () => {
    expect(displayValue(0)).toBe('0');
  });

  it('should return the string representation for false', () => {
    expect(displayValue(false)).toBe('false');
  });

  it('should return the string representation for true', () => {
    expect(displayValue(true)).toBe('true');
  });
});
