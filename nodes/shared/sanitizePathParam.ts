/**
 * Validates a value meant for a URL path segment and returns it encoded.
 * Rejects blanks and anything that could traverse or reshape the path
 * (`..`, `/`, `\`) before encoding.
 */
export function sanitizePathParam(value: string, paramName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${paramName} cannot be empty`);
  }
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error(`${paramName} contains invalid characters`);
  }
  return encodeURIComponent(trimmed);
}
