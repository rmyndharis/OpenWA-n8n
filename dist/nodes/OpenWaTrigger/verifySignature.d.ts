/**
 * Verifies an OpenWA webhook delivery signature.
 *
 * OpenWA signs the raw request body with HMAC-SHA256 and sends it as
 * `X-OpenWA-Signature: sha256=<hex>`. The signed bytes are the exact
 * `JSON.stringify(payload)` that is transmitted, so the receiver must hash the
 * raw bytes it received — re-serializing a parsed body can reorder keys or
 * change whitespace and reject otherwise-valid deliveries.
 *
 * Returns false when no secret or no signature is supplied; the caller decides
 * how to treat an unsigned request.
 */
export declare function verifyOpenWaSignature(rawBody: Buffer | string, secret: string, signatureHeader: string | undefined): boolean;
