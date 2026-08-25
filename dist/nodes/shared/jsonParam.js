"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJsonParam = parseJsonParam;
exports.stableStringify = stableStringify;
/**
 * Reads a node parameter declared as `type: 'json'`, which reaches the handler as
 * either the text the user typed or, when the field is driven by a single
 * expression, an already-resolved object. Both shapes are accepted.
 *
 * Returns undefined when nothing was supplied, so a caller can omit the key rather
 * than send a blank one. Throws SyntaxError on malformed text; callers wrap that in
 * a NodeOperationError naming the field.
 */
function parseJsonParam(raw) {
    if (raw === undefined || raw === null) {
        return undefined;
    }
    if (typeof raw !== 'string') {
        return raw;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
        return undefined;
    }
    return JSON.parse(trimmed);
}
/**
 * Key-order-insensitive serialisation, for comparing a value the node sent against
 * the same value read back from the server. The server round-trips filters through
 * a JSON column, and some backends do not preserve key order, so a plain
 * JSON.stringify comparison would report drift that is not there and re-register
 * the webhook on every activation.
 */
function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value ?? null);
    }
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    const entries = Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}
//# sourceMappingURL=jsonParam.js.map