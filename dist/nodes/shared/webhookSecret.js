"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_WEBHOOK_SECRET_LENGTH = void 0;
exports.isWebhookSecretTooShort = isWebhookSecretTooShort;
/**
 * Minimum HMAC secret length the server accepts when registering a webhook.
 * Mirrors the `@MinLength(16)` on the core server's webhook-create DTO
 * (server >= 0.20.0); the floor exists because a short key is brute-forcible
 * from one observed signature. The node enforces it on rotation too, so an
 * update cannot slip below the floor the server set at creation.
 */
exports.MIN_WEBHOOK_SECRET_LENGTH = 16;
/**
 * True when a secret is set but shorter than the registration floor.
 * Empty (or missing) means "no signing", which every server version allows.
 */
function isWebhookSecretTooShort(secret) {
    if (!secret) {
        return false;
    }
    return secret.length < exports.MIN_WEBHOOK_SECRET_LENGTH;
}
//# sourceMappingURL=webhookSecret.js.map