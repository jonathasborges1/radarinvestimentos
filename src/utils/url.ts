/**
 * Validates whether a string is a valid URL with http or https protocol.
 *
 * Uses the native URL constructor for parsing. Only accepts URLs
 * whose protocol is exactly "http:" or "https:".
 *
 * @param value - The string to validate
 * @returns true if the string is a valid http/https URL, false otherwise
 */
export function isValidUrl(value: string): boolean {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
