import { createHmac, timingSafeEqual } from 'node:crypto';

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
export function verifyOpenWaSignature(
  rawBody: Buffer | string,
  secret: string,
  signatureHeader: string | undefined,
): boolean {
  if (!secret || !signatureHeader) {
    return false;
  }

  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const provided = Buffer.from(signatureHeader);
  const expectedBuf = Buffer.from(expected);

  // timingSafeEqual throws on unequal lengths; the signature length is fixed,
  // so a length mismatch is itself a non-match and leaks nothing useful.
  if (provided.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(provided, expectedBuf);
}
