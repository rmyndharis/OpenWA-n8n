/**
 * Parses and validates the "Messages" input for the Send Bulk operation.
 *
 * Accepts a JSON string or an already-parsed value and enforces the server's
 * batch contract: a non-empty array of at most 100 items. Throws a plain Error
 * with a user-facing message on any violation; the caller wraps it in a
 * NodeOperationError with the item index.
 */
export function parseBulkMessages(raw: unknown): unknown[] {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (!Array.isArray(parsed)) {
    throw new Error('Messages must be a JSON array');
  }
  if (parsed.length === 0) {
    throw new Error('Messages must contain at least one item');
  }
  if (parsed.length > 100) {
    throw new Error('Messages cannot exceed 100 items per batch');
  }
  return parsed;
}
