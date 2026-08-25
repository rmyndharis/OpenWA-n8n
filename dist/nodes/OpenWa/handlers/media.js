"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMediaRequest = buildMediaRequest;
const n8n_workflow_1 = require("n8n-workflow");
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
/**
 * Server-side media conversion.
 *
 * This exists to make the node's own "Send as Voice Note" toggle honest. Nothing
 * else in the pipeline transcodes: the gateway forwards the bytes it is given and
 * labels them as a voice note, so posting MP3 bytes with that toggle on produces a
 * microphone bubble that will not play. Convert first, then feed the returned
 * `base64` and `mimetype` into Message > Send Audio or Status > Send Voice.
 *
 * Conversion is opt-in on the server and needs ffmpeg, so it can be unavailable on
 * an otherwise current gateway. Check Availability reports whether it is.
 */
async function buildMediaRequest(operation, itemIndex) {
    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
    const base = `/api/sessions/${sessionId}/media/convert`;
    if (operation === 'checkConversion') {
        return { endpoint: base, method: 'GET', body: {} };
    }
    if (operation !== 'convertVoice' && operation !== 'convertVideo') {
        return null;
    }
    // ConvertMediaDto declares `url` and `base64` and nothing else, so this cannot go
    // through the shared media resolver: that one also emits `mimetype`, which the
    // server rejects here rather than ignoring. The source bytes describe themselves.
    const source = this.getNodeParameter('mediaConvertSource', itemIndex, 'binary');
    let body;
    if (source === 'url') {
        const url = this.getNodeParameter('mediaConvertUrl', itemIndex, '').trim();
        if (!url) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Media URL cannot be empty', { itemIndex });
        }
        body = { url };
    }
    else if (source === 'base64') {
        const base64 = this.getNodeParameter('mediaConvertBase64', itemIndex, '').trim();
        if (!base64) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Base64 data cannot be empty', { itemIndex });
        }
        body = { base64 };
    }
    else {
        const binaryPropertyName = this.getNodeParameter('mediaConvertBinaryProperty', itemIndex, 'data');
        // Assert first, as the shared media resolver does: without it a wrong field name
        // surfaces as an opaque API error instead of naming the missing property.
        this.helpers.assertBinaryData(itemIndex, binaryPropertyName);
        const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
        body = { base64: buffer.toString('base64') };
    }
    return {
        endpoint: `${base}/${operation === 'convertVoice' ? 'voice' : 'video'}`,
        method: 'POST',
        body,
    };
}
//# sourceMappingURL=media.js.map