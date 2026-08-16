/**
 * Minimum HMAC secret length the server accepts when registering a webhook.
 * Mirrors the `@MinLength(16)` on the core server's webhook-create DTO
 * (server >= 0.20.0); the floor exists because a short key is brute-forcible
 * from one observed signature. The node enforces it on rotation too, so an
 * update cannot slip below the floor the server set at creation.
 */
export const MIN_WEBHOOK_SECRET_LENGTH = 16;

/**
 * True when a secret is set but shorter than the registration floor.
 * Empty (or missing) means "no signing", which every server version allows.
 */
export function isWebhookSecretTooShort(secret: string): boolean {
  if (!secret) {
    return false;
  }
  return secret.length < MIN_WEBHOOK_SECRET_LENGTH;
}
