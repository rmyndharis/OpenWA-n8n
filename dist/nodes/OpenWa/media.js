"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveMediaSource = resolveMediaSource;
exports.assertImageMedia = assertImageMedia;
exports.mediaValue = mediaValue;
const params_1 = require("./handlers/params");
/**
 * Resolves the binary/url/base64 media-source fields shared by the send-* media
 * operations into request body fields. Binary data is sent as base64. OpenWA
 * rejects base64 without a mimetype, so a binary item that somehow carries no
 * MIME type falls back to `binaryFallbackMime` (per media kind).
 */
async function resolveMediaSource(itemIndex, params, binaryFallbackMime) {
    const source = this.getNodeParameter(params.source, itemIndex);
    if (source === 'binary') {
        const binaryPropertyName = this.getNodeParameter(params.binaryProperty, itemIndex);
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
        mimetype: this.getNodeParameter(params.mimeType, itemIndex),
    };
}
/**
 * Refuses media that cannot be a picture. The gateway takes a profile or group picture
 * only when its MIME type matches `^image/`, and a binary item downloaded by an HTTP
 * Request often arrives as application/octet-stream. Its 400 names the field in
 * development only, so the reason is given here. A URL source carries no MIME type to
 * check: the gateway reads it from the download.
 */
function assertImageMedia(media, label) {
    const mimetype = media.mimetype;
    if (typeof mimetype === 'string' && !/^image\//.test(mimetype)) {
        throw new Error(`${label} must be an image, but its MIME type is "${mimetype}". Give the binary item an image/* MIME type upstream, or use the Base64 source and set the MIME type here.`);
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
function mediaValue(value, label) {
    if (Array.isArray(value)) {
        if (value.length !== 1) {
            throw new Error(`${label} must be a single value, not a list`);
        }
        value = value[0];
    }
    const text = (0, params_1.asText)(value, label);
    if (!text) {
        throw new Error(`${label} cannot be empty`);
    }
    return text;
}
