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
export declare function webhookConfigHash(config: {
    url: string;
    events: string[];
    secret: string;
    sessionId: string;
    filters?: unknown;
}): string;
