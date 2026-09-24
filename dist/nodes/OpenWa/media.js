"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveMediaSource = resolveMediaSource;
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
        return { url: mediaValue(this.getNodeParameter(params.url, itemIndex), 'Media URL') };
    }
    return {
        base64: mediaValue(this.getNodeParameter(params.base64, itemIndex), 'Base64 Data'),
        mimetype: this.getNodeParameter(params.mimeType, itemIndex),
    };
}
/**
 * A URL or base64 payload, trimmed and coerced. A list holding one value is read as
 * that value; a longer one is refused rather than joined: joined, two URLs read as
 * one bogus URL and two base64 payloads decode to one corrupt file, the first alone
 * or both run together depending on padding. A blank one is
 * refused by name, since the gateway's own 400 for it names no field in production.
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
