/**
 * Parses and validates the "Messages" input for the Send Bulk operation.
 *
 * Accepts a JSON string or an already-parsed value and enforces the server's
 * batch contract: a non-empty array of at most 100 items. Throws a plain Error
 * with a user-facing message on any violation; the caller wraps it in a
 * NodeOperationError with the item index.
 */
export declare function parseBulkMessages(raw: unknown): unknown[];
