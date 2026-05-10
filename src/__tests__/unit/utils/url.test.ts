import { describe, it, expect } from 'vitest';
import { isValidUrl } from '../../../utils/url';

describe('isValidUrl', () => {
  it('should accept a valid https URL', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
  });

  it('should accept a valid http URL', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('should accept https URL with path', () => {
    expect(isValidUrl('https://example.com/path/to/page')).toBe(true);
  });

  it('should accept https URL with query parameters', () => {
    expect(isValidUrl('https://example.com/search?q=test&page=1')).toBe(true);
  });

  it('should accept https URL with port', () => {
    expect(isValidUrl('https://example.com:8080')).toBe(true);
  });

  it('should accept https URL with fragment', () => {
    expect(isValidUrl('https://example.com/page#section')).toBe(true);
  });

  it('should reject empty string', () => {
    expect(isValidUrl('')).toBe(false);
  });

  it('should reject ftp protocol', () => {
    expect(isValidUrl('ftp://example.com')).toBe(false);
  });

  it('should reject mailto protocol', () => {
    expect(isValidUrl('mailto:user@example.com')).toBe(false);
  });

  it('should reject file protocol', () => {
    expect(isValidUrl('file:///etc/passwd')).toBe(false);
  });

  it('should reject string without protocol', () => {
    expect(isValidUrl('example.com')).toBe(false);
  });

  it('should reject plain text', () => {
    expect(isValidUrl('not a url')).toBe(false);
  });

  it('should reject javascript protocol', () => {
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
  });

  it('should accept a real fiduciary agent URL', () => {
    expect(isValidUrl('https://www.virgo.com.br')).toBe(true);
  });
});
