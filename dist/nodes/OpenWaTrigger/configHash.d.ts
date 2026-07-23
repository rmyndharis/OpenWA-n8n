/**
 * Stable fingerprint of the trigger configuration that the server-side webhook
 * registration depends on: the delivery URL n8n advertises, the subscribed
 * events, the signing secret, and the session. When any of these changes, the
 * stored registration is stale and must be re-created — checkExists compares
 * this hash and re-registers on a mismatch.
 *
 * Only the hash is ever kept in workflow static data (which lives in the n8n
 * database) — the secret itself is never stored.
 */
export declare function webhookConfigHash(config: {
    url: string;
    events: string[];
    secret: string;
    sessionId: string;
}): string;
