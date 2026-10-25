"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizePathParam = sanitizePathParam;
const params_1 = require("../OpenWa/handlers/params");
/**
 * Validates a value meant for a URL path segment and returns it encoded.
 * Rejects blanks and anything that could traverse or reshape the path
 * (`..`, `/`, `\`) before encoding.
 */
function sanitizePathParam(value, paramName) {
    // Read as text like every other field: an expression can resolve to a number, a
    // list or an object, and String() on an object put "[object Object]" in the path.
    // asText names the field and refuses what has no text form.
    const trimmed = (0, params_1.asText)(value, paramName);
    if (!trimmed) {
        throw new Error(`${paramName} cannot be empty`);
    }
    if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
        throw new Error(`${paramName} contains invalid characters`);
    }
    let encoded;
    try {
        encoded = encodeURIComponent(trimmed);
    }
    catch {
        // A lone surrogate, such as half an emoji left by a substring, cannot be encoded.
    }
    if (encoded === undefined) {
        throw new Error(`${paramName} contains invalid characters`);
    }
    return encoded;
}
