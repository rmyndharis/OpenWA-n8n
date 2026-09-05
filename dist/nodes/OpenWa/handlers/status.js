"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStatusRequest = buildStatusRequest;
const n8n_workflow_1 = require("n8n-workflow");
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
const media_1 = require("../media");
const params_1 = require("./params");
const STATUS_IMAGE_MEDIA = {
    source: 'statusImageSource',
    binaryProperty: 'statusImageBinaryProperty',
    url: 'statusImageUrl',
    base64: 'statusImageBase64',
    mimeType: 'statusImageMimeType',
};
const STATUS_VOICE_MEDIA = {
    source: 'statusVoiceSource',
    binaryProperty: 'statusVoiceBinaryProperty',
    url: 'statusVoiceUrl',
    base64: 'statusVoiceBase64',
    mimeType: 'statusVoiceMimeType',
};
const STATUS_VIDEO_MEDIA = {
    source: 'statusVideoSource',
    binaryProperty: 'statusVideoBinaryProperty',
    url: 'statusVideoUrl',
    base64: 'statusVideoBase64',
    mimeType: 'statusVideoMimeType',
};
const MAX_TEXT_LENGTH = 4096;
const MAX_CAPTION_LENGTH = 1024;
const MAX_RECIPIENTS = 256;
/**
 * Reads the optional recipient list shared by all three send operations.
 *
 * WhatsApp Status is never posted to a group, so these are `@c.us`/`@lid` JIDs.
 * The Baileys engine requires an explicit list and honors it. whatsapp-web.js
 * does NOT: it posts to the whole contact list whether a list is given or not,
 * and the server logs a warning when one is supplied. Treat a recipient list as
 * an audience restriction on Baileys only.
 */
function getRecipients(ctx, itemIndex) {
    const recipients = (0, params_1.toStringList)(ctx.getNodeParameter('statusRecipients', itemIndex, ''));
    if (recipients.length === 0) {
        return undefined;
    }
    if (recipients.length > MAX_RECIPIENTS) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `Recipients cannot exceed ${MAX_RECIPIENTS} entries (got ${recipients.length})`, { itemIndex });
    }
    return recipients;
}
/** Reads the optional caption shared by the image and video send operations. */
function getCaption(ctx, itemIndex) {
    const caption = (0, params_1.asText)(ctx.getNodeParameter('statusCaption', itemIndex, ''), 'Caption');
    if (!caption) {
        return undefined;
    }
    if (caption.length > MAX_CAPTION_LENGTH) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `Caption cannot exceed ${MAX_CAPTION_LENGTH} characters`, { itemIndex });
    }
    return caption;
}
/**
 * WhatsApp Status (stories) — reading the status feed and posting text, image,
 * or video updates.
 */
async function buildStatusRequest(operation, itemIndex) {
    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
    const base = `/api/sessions/${sessionId}/status`;
    switch (operation) {
        case 'list':
            return { endpoint: base, method: 'GET', body: {} };
        case 'getByContact': {
            const contactId = encodeURIComponent((0, params_1.requireJid)(this, 'statusContactId', 'Contact ID', itemIndex));
            return { endpoint: `${base}/${contactId}`, method: 'GET', body: {} };
        }
        case 'getMedia': {
            const statusId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('statusId', itemIndex), 'Status ID');
            // The route streams the stored image or video bytes, not JSON.
            return {
                endpoint: `${base}/${statusId}/media`,
                method: 'GET',
                body: {},
                responseFormat: 'binary',
            };
        }
        case 'delete': {
            const statusId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('statusId', itemIndex), 'Status ID');
            return { endpoint: `${base}/${statusId}`, method: 'DELETE', body: {} };
        }
        case 'sendText': {
            const body = {
                text: (0, params_1.requireText)(this, 'statusText', 'Status text', itemIndex, MAX_TEXT_LENGTH),
            };
            const backgroundColor = (0, params_1.asText)(this.getNodeParameter('statusBackgroundColor', itemIndex, ''), 'Background colour');
            if (backgroundColor) {
                body.backgroundColor = backgroundColor;
            }
            const font = this.getNodeParameter('statusFont', itemIndex, -1);
            // -1 is the node's "leave to the server" sentinel; 0 is a real font index.
            if (font >= 0) {
                body.font = font;
            }
            const recipients = getRecipients(this, itemIndex);
            if (recipients) {
                body.recipients = recipients;
            }
            return { endpoint: `${base}/send-text`, method: 'POST', body };
        }
        case 'sendVoice': {
            // Like the image and video sends, the media nests under its own key rather
            // than sitting flat on the body.
            const body = {
                audio: await media_1.resolveMediaSource.call(this, itemIndex, STATUS_VOICE_MEDIA, 'audio/ogg; codecs=opus'),
            };
            const backgroundColor = (0, params_1.asText)(this.getNodeParameter('statusBackgroundColor', itemIndex, ''), 'Background colour');
            if (backgroundColor) {
                body.backgroundColor = backgroundColor;
            }
            const recipients = getRecipients(this, itemIndex);
            if (recipients) {
                body.recipients = recipients;
            }
            return { endpoint: `${base}/send-voice`, method: 'POST', body };
        }
        case 'sendImage':
        case 'sendVideo': {
            const isImage = operation === 'sendImage';
            // The media object nests under `image` / `video` rather than sitting flat
            // on the body, unlike the message send-* routes.
            const media = await media_1.resolveMediaSource.call(this, itemIndex, isImage ? STATUS_IMAGE_MEDIA : STATUS_VIDEO_MEDIA, isImage ? 'image/jpeg' : 'video/mp4');
            const body = { [isImage ? 'image' : 'video']: media };
            const caption = getCaption(this, itemIndex);
            if (caption) {
                body.caption = caption;
            }
            const recipients = getRecipients(this, itemIndex);
            if (recipients) {
                body.recipients = recipients;
            }
            return {
                endpoint: `${base}/${isImage ? 'send-image' : 'send-video'}`,
                method: 'POST',
                body,
            };
        }
        default:
            return null;
    }
}
