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
  if (source === 'url') {
    return { url: mediaValue(this.getNodeParameter(params.url, itemIndex), params.urlLabel) };
  }
  return {
    base64: mediaValue(this.getNodeParameter(params.base64, itemIndex), 'Base64 Data'),
    mimetype: this.getNodeParameter(params.mimeType, itemIndex) as string,
  };
}

/**
 * Refuses media that cannot be a picture. The gateway takes a profile or group picture
 * only when its MIME type matches `^image/`, and a binary item downloaded by an HTTP
 * Request often arrives as application/octet-stream. Its 400 names the field in
 * development only, so the reason is given here. A URL source carries no MIME type to
 * check: the gateway reads it from the download.
 */
export function assertImageMedia(
  media: Record<string, unknown>,
  label: string,
): Record<string, unknown> {
  const mimetype = media.mimetype;
  if (typeof mimetype === 'string' && !/^image\//.test(mimetype)) {
    throw new Error(
      `${label} must be an image, but its MIME type is "${mimetype}". Give the binary item an image/* MIME type upstream, or use the Base64 source and set the MIME type here.`,
    );
  }
  return media;
}

/**
 * A URL or base64 payload, trimmed and coerced. A list holding one value is read as
 * that value; a longer one is refused rather than joined: joined, two URLs read as
 * one bogus URL and two base64 payloads decode to one corrupt file, the first alone
 * or both run together depending on padding. A blank one is refused by name before
 * the request, where the gateway's 400 for it varies by route.
 */
export function mediaValue(value: unknown, label: string): string {
  if (Array.isArray(value)) {
    if (value.length !== 1) {
      throw new Error(`${label} must be a single value, not a list`);
    }
    value = value[0];
  }
  const text = asText(value, label);
  if (!text) {
    throw new Error(`${label} cannot be empty`);
  }
  return text;
}
