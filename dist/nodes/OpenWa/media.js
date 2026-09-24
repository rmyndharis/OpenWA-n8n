"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveMediaSource = resolveMediaSource;
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
    // Trimmed and coerced: a URL pasted with a stray space is refused by the gateway
    // with a 400 that names no field, and an object would be sent as one.
    if (source === 'url') {
        return { url: (0, params_1.asText)(this.getNodeParameter(params.url, itemIndex), 'Media URL') };
    }
    return {
        base64: (0, params_1.asText)(this.getNodeParameter(params.base64, itemIndex), 'Base64 Data'),
        mimetype: this.getNodeParameter(params.mimeType, itemIndex),
    };
}
