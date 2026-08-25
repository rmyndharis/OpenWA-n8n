"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookConfigHash = webhookConfigHash;
const node_crypto_1 = require("node:crypto");
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
        // Compared as the raw text the user typed. Reformatting it re-registers, which
        // is harmless; the alternative is canonicalising arbitrary JSON to avoid it.
        filters: config.filters ?? '',
    });
    return (0, node_crypto_1.createHash)('sha256').update(canonical).digest('hex');
}
//# sourceMappingURL=configHash.js.map