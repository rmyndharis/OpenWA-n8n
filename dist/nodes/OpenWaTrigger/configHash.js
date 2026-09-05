"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookConfigHash = webhookConfigHash;
const node_crypto_1 = require("node:crypto");
const jsonParam_1 = require("../shared/jsonParam");
/**
 * Stable fingerprint of the trigger configuration that the server-side webhook
 * registration depends on: the delivery URL n8n advertises, the subscribed
 * events, the signing secret, the session, and any server-side filters. When any of these changes, the
 * stored registration is stale and must be re-created — checkExists compares
 * this hash and re-registers on a mismatch.
 *
 * Only the hash is ever kept in workflow static data (which lives in the n8n
 * database) — the secret itself is never stored.
 */
function webhookConfigHash(config) {
    const canonical = JSON.stringify({
        url: config.url,
        events: [...config.events].sort(),
        secret: config.secret,
        sessionId: config.sessionId,
        // Normalised here rather than at the call sites, so checkExists and create
        // cannot disagree. A `json` parameter arrives as text or as a resolved object
        // depending on whether an expression drives it, and reformatting or reordering
        // the same filter must not read as a change.
        filters: filtersFingerprint(config.filters),
    });
    return (0, node_crypto_1.createHash)('sha256').update(canonical).digest('hex');
}
function filtersFingerprint(filters) {
    if (filters === undefined || filters === null || filters === '') {
        return '';
    }
    if (typeof filters === 'string') {
        const trimmed = filters.trim();
        if (!trimmed) {
            return '';
        }
        try {
            return (0, jsonParam_1.stableStringify)(JSON.parse(trimmed));
        }
        catch {
            // Not valid JSON: fingerprint the text so a later correction still registers
            // as a change. create() is where the user gets told it is malformed.
            return trimmed;
        }
    }
    return (0, jsonParam_1.stableStringify)(filters);
}
