"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizePathParam = sanitizePathParam;
/**
 * Validates a value meant for a URL path segment and returns it encoded.
 * Rejects blanks and anything that could traverse or reshape the path
 * (`..`, `/`, `\`) before encoding.
 */
function sanitizePathParam(value, paramName) {
    // Coerced rather than trimmed directly: an expression can resolve to a number or
    // an object, and .trim() on one throws a TypeError that surfaces as an opaque API
    // error. The emptiness check below then names the field instead.
    const trimmed = value === undefined || value === null ? '' : String(value).trim();
    if (!trimmed) {
        throw new Error(`${paramName} cannot be empty`);
    }
    if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
        throw new Error(`${paramName} contains invalid characters`);
    }
    return encodeURIComponent(trimmed);
}
//# sourceMappingURL=sanitizePathParam.js.map