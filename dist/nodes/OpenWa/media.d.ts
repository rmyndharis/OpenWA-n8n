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
