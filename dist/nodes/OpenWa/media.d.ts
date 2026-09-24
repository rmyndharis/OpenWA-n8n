import type { IExecuteFunctions } from 'n8n-workflow';
/**
 * Names of the per-operation media fields. Every send-* media operation carries
 * the same five fields with an operation-specific prefix (e.g. `imageSource`,
 * `imageBinaryProperty`, … for Send Image).
 */
export interface MediaParamNames {
    source: string;
    binaryProperty: string;
    url: string;
    /** The URL field's display name, which the errors about it quote. */
    urlLabel: string;
    base64: string;
    mimeType: string;
}
/**
 * Resolves the binary/url/base64 media-source fields shared by the send-* media
 * operations into request body fields. Binary data is sent as base64. OpenWA
 * rejects base64 without a mimetype, so a binary item that somehow carries no
 * MIME type falls back to `binaryFallbackMime` (per media kind).
 */
export declare function resolveMediaSource(this: IExecuteFunctions, itemIndex: number, params: MediaParamNames, binaryFallbackMime: string): Promise<Record<string, unknown>>;
/**
 * A URL or base64 payload, trimmed and coerced. A list holding one value is read as
 * that value; a longer one is refused rather than joined: joined, two URLs read as
 * one bogus URL and two base64 payloads decode to one corrupt file, the first alone
 * or both run together depending on padding. A blank one is refused by name before
 * the request, where the gateway's 400 for it varies by route.
 */
export declare function mediaValue(value: unknown, label: string): string;
