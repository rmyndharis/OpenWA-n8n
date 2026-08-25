/**
 * Bounds the server places on an HMAC secret when registering a webhook.
 * Mirrors `@MinLength(16) @MaxLength(255)` on the core server's webhook-create
 * DTO (server >= 0.20.0). The floor exists because a short key is brute-forcible
 * from one observed signature; the ceiling is the column width. The node enforces
 * both on rotation too, so an update cannot slip outside the range the server set
 * at creation.
 */
export declare const MIN_WEBHOOK_SECRET_LENGTH = 16;
export declare const MAX_WEBHOOK_SECRET_LENGTH = 255;
/**
 * The reason the server would refuse this secret at registration, or null when it
 * would accept it. Empty (or missing) means "no signing", which every server
 * version allows.
 */
export declare function webhookSecretProblem(secret: string): string | null;
