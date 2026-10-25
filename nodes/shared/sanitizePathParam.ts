import { asText } from '../OpenWa/handlers/params';

/**
 * Validates a value meant for a URL path segment and returns it encoded.
 * Rejects blanks and anything that could traverse or reshape the path
 * (`..`, `/`, `\`) before encoding.
 */
export function sanitizePathParam(value: string, paramName: string): string {
  // Read as text like every other field: an expression can resolve to a number, a
  // list or an object, and String() on an object put "[object Object]" in the path.
  // asText names the field and refuses what has no text form.
  const trimmed = asText(value, paramName);
  if (!trimmed) {
    throw new Error(`${paramName} cannot be empty`);
  }
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error(`${paramName} contains invalid characters`);
  }
  let encoded: string | undefined;
  try {
    encoded = encodeURIComponent(trimmed);
  } catch {
    // A lone surrogate, such as half an emoji left by a substring, cannot be encoded.
  }
  if (encoded === undefined) {
    throw new Error(`${paramName} contains invalid characters`);
  }
  return encoded;
}
