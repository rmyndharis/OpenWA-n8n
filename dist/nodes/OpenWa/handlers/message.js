"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMessageRequest = buildMessageRequest;
const n8n_workflow_1 = require("n8n-workflow");
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
const bulkMessages_1 = require("../bulkMessages");
const media_1 = require("../media");
const IMAGE_MEDIA = {
    source: 'imageSource',
    binaryProperty: 'imageBinaryProperty',
    url: 'imageUrl',
    base64: 'imageBase64',
    mimeType: 'imageMimeType',
};
const DOCUMENT_MEDIA = {
    source: 'documentSource',
    binaryProperty: 'documentBinaryProperty',
    url: 'documentUrl',
    base64: 'documentBase64',
    mimeType: 'documentMimeType',
};
const AUDIO_MEDIA = {
    source: 'audioSource',
    binaryProperty: 'audioBinaryProperty',
    url: 'audioUrl',
    base64: 'audioBase64',
    mimeType: 'audioMimeType',
};
const VIDEO_MEDIA = {
    source: 'videoSource',
    binaryProperty: 'videoBinaryProperty',
    url: 'videoUrl',
    base64: 'videoBase64',
    mimeType: 'videoMimeType',
};
const STICKER_MEDIA = {
    source: 'stickerSource',
    binaryProperty: 'stickerBinaryProperty',
    url: 'stickerUrl',
    base64: 'stickerBase64',
    mimeType: 'stickerMimeType',
};
async function buildMessageRequest(operation, itemIndex) {
    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
    // Bulk / batch operations are not addressed to a single chat, so they skip Chat ID.
    let chatId = '';
    if (operation !== 'sendBulk' &&
        operation !== 'getBatchStatus' &&
        operation !== 'cancelBatch') {
        chatId = this.getNodeParameter('chatId', itemIndex).trim();
        if (!chatId) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Chat ID cannot be empty', {
                itemIndex,
            });
        }
    }
    let endpoint = '';
    let body = {};
    if (operation === 'sendText') {
        endpoint = `/api/sessions/${sessionId}/messages/send-text`;
        body = {
            chatId,
            text: this.getNodeParameter('message', itemIndex),
        };
    }
    else if (operation === 'sendImage') {
        endpoint = `/api/sessions/${sessionId}/messages/send-image`;
        body = { chatId };
        const caption = this.getNodeParameter('caption', itemIndex, '').trim();
        if (caption) {
            body.caption = caption;
        }
        // OpenWA rejects base64 without a mimetype; fall back to the server's own
        // default if the binary item somehow carries no MIME type.
        Object.assign(body, await media_1.resolveMediaSource.call(this, itemIndex, IMAGE_MEDIA, 'application/octet-stream'));
    }
    else if (operation === 'sendDocument') {
        endpoint = `/api/sessions/${sessionId}/messages/send-document`;
        body = {
            chatId,
            filename: this.getNodeParameter('filename', itemIndex, 'document.pdf'),
        };
        const caption = this.getNodeParameter('caption', itemIndex, '').trim();
        if (caption) {
            body.caption = caption;
        }
        Object.assign(body, await media_1.resolveMediaSource.call(this, itemIndex, DOCUMENT_MEDIA, 'application/octet-stream'));
    }
    else if (operation === 'sendLocation') {
        endpoint = `/api/sessions/${sessionId}/messages/send-location`;
        body = {
            chatId,
            latitude: this.getNodeParameter('latitude', itemIndex),
            longitude: this.getNodeParameter('longitude', itemIndex),
        };
        const locationName = this.getNodeParameter('locationName', itemIndex, '').trim();
        if (locationName) {
            // OpenWA's SendLocationDto uses `description` for the location label.
            body.description = locationName;
        }
    }
    else if (operation === 'sendAudio') {
        endpoint = `/api/sessions/${sessionId}/messages/send-audio`;
        body = { chatId };
        // Fall back to the voice-note format if the binary item carries no MIME type.
        Object.assign(body, await media_1.resolveMediaSource.call(this, itemIndex, AUDIO_MEDIA, 'audio/ogg; codecs=opus'));
        // Deliver as a true WhatsApp voice note (PTT). Only attach `ptt` when enabled so
        // plain-audio sends stay backward-compatible; the field requires server >= v0.7.17.
        if (this.getNodeParameter('sendAsVoiceNote', itemIndex, false)) {
            body.ptt = true;
        }
    }
    else if (operation === 'reply') {
        endpoint = `/api/sessions/${sessionId}/messages/reply`;
        body = {
            chatId,
            quotedMessageId: this.getNodeParameter('quotedMessageId', itemIndex).trim(),
            text: this.getNodeParameter('message', itemIndex),
        };
    }
    else if (operation === 'react') {
        endpoint = `/api/sessions/${sessionId}/messages/react`;
        // An empty emoji removes the existing reaction — the field is intentionally sent.
        body = {
            chatId,
            messageId: this.getNodeParameter('messageId', itemIndex).trim(),
            emoji: this.getNodeParameter('emoji', itemIndex, ''),
        };
    }
    else if (operation === 'delete') {
        endpoint = `/api/sessions/${sessionId}/messages/delete`;
        body = {
            chatId,
            messageId: this.getNodeParameter('messageId', itemIndex).trim(),
            forEveryone: this.getNodeParameter('forEveryone', itemIndex, true),
        };
    }
    else if (operation === 'sendVideo') {
        endpoint = `/api/sessions/${sessionId}/messages/send-video`;
        body = { chatId };
        const caption = this.getNodeParameter('caption', itemIndex, '').trim();
        if (caption) {
            body.caption = caption;
        }
        Object.assign(body, await media_1.resolveMediaSource.call(this, itemIndex, VIDEO_MEDIA, 'application/octet-stream'));
    }
    else if (operation === 'sendSticker') {
        endpoint = `/api/sessions/${sessionId}/messages/send-sticker`;
        body = { chatId };
        // Stickers must be WebP; fall back to that if the binary item carries no MIME type.
        Object.assign(body, await media_1.resolveMediaSource.call(this, itemIndex, STICKER_MEDIA, 'image/webp'));
    }
    else if (operation === 'sendContact') {
        endpoint = `/api/sessions/${sessionId}/messages/send-contact`;
        body = {
            chatId,
            contactName: this.getNodeParameter('contactName', itemIndex).trim(),
            contactNumber: this.getNodeParameter('contactNumber', itemIndex).trim(),
        };
    }
    else if (operation === 'sendBulk') {
        endpoint = `/api/sessions/${sessionId}/messages/send-bulk`;
        let messages;
        try {
            messages = (0, bulkMessages_1.parseBulkMessages)(this.getNodeParameter('bulkMessages', itemIndex, '[]'));
        }
        catch (e) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), e.message, { itemIndex });
        }
        body = { messages };
        const batchId = this.getNodeParameter('batchId', itemIndex, '').trim();
        if (batchId) {
            body.batchId = batchId;
        }
        const options = this.getNodeParameter('bulkOptions', itemIndex, {});
        if (Object.keys(options).length > 0) {
            body.options = options;
        }
    }
    else if (operation === 'getBatchStatus') {
        const batchId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('statusBatchId', itemIndex), 'Batch ID');
        return {
            endpoint: `/api/sessions/${sessionId}/messages/batch/${batchId}`,
            method: 'GET',
            body: {},
        };
    }
    else if (operation === 'cancelBatch') {
        const batchId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('statusBatchId', itemIndex), 'Batch ID');
        return {
            endpoint: `/api/sessions/${sessionId}/messages/batch/${batchId}/cancel`,
            method: 'POST',
            body: {},
        };
    }
    else {
        return null;
    }
    // Optional @mentions — only send-text/image/video/document accept them. Guard by
    // operation (not just the hidden field) so a mentions value can never ride
    // along on a sendLocation request, whose DTO rejects unknown fields (400).
    if (operation === 'sendText' ||
        operation === 'sendImage' ||
        operation === 'sendDocument' ||
        operation === 'sendVideo') {
        const rawMentions = this.getNodeParameter('mentions', itemIndex, []);
        const mentions = (Array.isArray(rawMentions) ? rawMentions : [])
            .map((m) => String(m).trim())
            .filter(Boolean);
        if (mentions.length > 0) {
            body.mentions = mentions;
        }
    }
    return { endpoint, method: 'POST', body };
}
//# sourceMappingURL=message.js.map