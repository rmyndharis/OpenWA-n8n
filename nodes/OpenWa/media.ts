import type { IExecuteFunctions } from 'n8n-workflow';
import { asText } from './handlers/params';

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
export async function resolveMediaSource(
  this: IExecuteFunctions,
  itemIndex: number,
  params: MediaParamNames,
  binaryFallbackMime: string,
): Promise<Record<string, unknown>> {
  const source = this.getNodeParameter(params.source, itemIndex) as string;
  if (source === 'binary') {
    const binaryPropertyName = this.getNodeParameter(params.binaryProperty, itemIndex) as string;
    const binary = this.helpers.assertBinaryData(itemIndex, binaryPropertyName);
    const binaryData = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
    return {
      base64: binaryData.toString('base64'),
      mimetype: binary.mimeType || binaryFallbackMime,
    };
  }
  // Trimmed and coerced: a URL pasted with a stray space is refused by the gateway
  // with a 400 that names no field, and an object would be sent as one.
  if (source === 'url') {
    return { url: asText(this.getNodeParameter(params.url, itemIndex), 'Media URL') };
  }
  return {
    base64: asText(this.getNodeParameter(params.base64, itemIndex), 'Base64 Data'),
    mimetype: this.getNodeParameter(params.mimeType, itemIndex) as string,
  };
}
