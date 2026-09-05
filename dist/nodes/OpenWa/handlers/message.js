"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMessageRequest = buildMessageRequest;
const n8n_workflow_1 = require("n8n-workflow");
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
const jsonParam_1 = require("../../shared/jsonParam");
const bulkMessages_1 = require("../bulkMessages");
const media_1 = require("../media");
const params_1 = require("./params");
/**
 * Operations that do not read the shared Chat ID field: the bulk/batch routes
 * are not addressed to one chat, Forward names a source and a target chat of
 * its own, and List takes an optional chat filter in its options collection.
 */
const CHATLESS_OPERATIONS = new Set([
    'sendBulk',
    'getBatchStatus',
    'cancelBatch',
    'forward',
    'list',
]);
// Server-side DTO limits.
const MAX_EDIT_BODY_LENGTH = 4096;
const MAX_POLL_NAME_LENGTH = 255;
// WhatsApp's own bounds on a poll.
const MIN_POLL_OPTIONS = 2;
const MAX_POLL_OPTIONS = 12;
// A vote may select at most this many of the poll's options. Zero is legal and
// clears the caller's vote, so this is an upper bound only.
const MAX_POLL_VOTE_OPTIONS = 12;
/**
 * Sends whose DTO declares `quotedMessageId`. Send Template and Edit do not, and the
 * server rejects any body field its DTO does not declare, so the set is explicit.
 */
const QUOTABLE_SENDS = new Set([
    'sendText',
    'sendImage',
    'sendVideo',
    'sendAudio',
    'sendDocument',
    'sendSticker',
    'sendLocation',
    'sendContact',
    'sendPoll',
]);
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
/**
 * Three states, which a boolean cannot express: leave it to the engine, ask for a
 * preview, or suppress one. The engines disagree about what "leave it" means, so the
 * distinction is real. On whatsapp-web.js a preview is built by default and only an
 * explicit false is forwarded; on Baileys previews are opt-in, and asking for one
 * costs a blocking fetch of every URL in the message before the send goes out.
 */
function applyLinkPreview(body, itemIndex) {
    const choice = this.getNodeParameter('linkPreview', itemIndex, 'default');
    if (choice === 'yes') {
        body.linkPreview = true;
    }
    else if (choice === 'no') {
        body.linkPreview = false;
    }
}
/**
 * A caller-supplied preview card, or undefined when the user opened the collection
 * without filling it in. An n8n collection yields `{}` as soon as it is opened, and
 * the server refuses that, so the object is rebuilt from the trimmed values instead
 * of being forwarded as-is.
 */
function readCustomLinkPreview(itemIndex) {
    const fields = this.getNodeParameter('customLinkPreview', itemIndex, {});
    const url = (0, params_1.asText)(fields.previewUrl);
    const title = (0, params_1.asText)(fields.previewTitle);
    if (!url || !title) {
        return undefined;
    }
    const preview = { url, title };
    const description = (0, params_1.asText)(fields.previewDescription);
    if (description) {
        preview.description = description;
    }
    return preview;
}
/**
 * A message body, coerced but deliberately NOT trimmed.
 *
 * Coerced because an expression can resolve to a number, which reads as text.
 * Not trimmed because a message body's leading and trailing whitespace is content
 * the user chose: `asText` would silently eat the blank line before a signature.
 *
 * An object is refused rather than stringified. The gateway validates with
 * `enableImplicitConversion`, which rewrites a value before `@IsString()` sees it,
 * so an object reaches WhatsApp as the literal text "[object Object]" instead of
 * being rejected. A sent message cannot be recalled once the delete window closes,
 * which makes a refusal here the only place that failure is still recoverable.
 */
function messageBody(ctx, raw, itemIndex) {
    if (raw === null || raw === undefined) {
        return '';
    }
    if (typeof raw === 'object') {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), 'Message must be text. Point the expression at the value itself, e.g. {{ $json.payload.text }}.', { itemIndex });
    }
    return typeof raw === 'string' ? raw : String(raw);
}
async function buildMessageRequest(operation, itemIndex) {
    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
    // Bulk / batch operations are not addressed to a single chat, and Forward and
    // List name their chats through their own fields, so all of them skip Chat ID.
    let chatId = '';
    if (!CHATLESS_OPERATIONS.has(operation)) {
        chatId = (0, params_1.asText)(this.getNodeParameter('chatId', itemIndex), 'Chat ID');
        if (!chatId) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Chat ID cannot be empty', {
                itemIndex,
            });
        }
    }
    // --- Reads -----------------------------------------------------------------
    if (operation === 'list') {
        const options = this.getNodeParameter('messageListOptions', itemIndex, {});
        return {
            endpoint: `/api/sessions/${sessionId}/messages`,
            method: 'GET',
            body: {},
            qs: (0, params_1.toQueryParams)(options),
        };
    }
    if (operation === 'getHistory') {
        const options = this.getNodeParameter('historyOptions', itemIndex, {});
        return {
            endpoint: `/api/sessions/${sessionId}/messages/${encodeURIComponent(chatId)}/history`,
            method: 'GET',
            body: {},
            qs: (0, params_1.toQueryParams)(options),
        };
    }
    if (operation === 'getReactions') {
        const messageId = (0, params_1.asText)(this.getNodeParameter('messageId', itemIndex), 'Message ID');
        if (!messageId) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Message ID cannot be empty', { itemIndex });
        }
        return {
            endpoint: `/api/sessions/${sessionId}/messages/${encodeURIComponent(chatId)}/${encodeURIComponent(messageId)}/reactions`,
            method: 'GET',
            body: {},
        };
    }
    if (operation === 'getMedia') {
        const messageId = (0, params_1.asText)(this.getNodeParameter('messageId', itemIndex), 'Message ID');
        if (!messageId) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Message ID cannot be empty', { itemIndex });
        }
        // Served from the gateway's own archive rather than the engine, so this works
        // while the session is stopped. The only failure is a 404.
        return {
            endpoint: `/api/sessions/${sessionId}/messages/${encodeURIComponent(chatId)}/${encodeURIComponent(messageId)}/media`,
            method: 'GET',
            body: {},
            responseFormat: 'binary',
        };
    }
    let endpoint = '';
    let body = {};
    if (operation === 'sendText') {
        endpoint = `/api/sessions/${sessionId}/messages/send-text`;
        body = {
            chatId,
            text: messageBody(this, this.getNodeParameter('message', itemIndex), itemIndex),
        };
        applyLinkPreview.call(this, body, itemIndex);
        const preview = readCustomLinkPreview.call(this, itemIndex);
        if (preview) {
            // The server refuses exactly this pair. `true` plus a custom preview is fine,
            // and so is a custom preview with no linkPreview at all.
            if (body.linkPreview === false) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'A Custom Link Preview cannot be combined with Link Preview set to No Preview', { itemIndex });
            }
            body.customLinkPreview = preview;
        }
    }
    else if (operation === 'sendImage') {
        endpoint = `/api/sessions/${sessionId}/messages/send-image`;
        body = { chatId };
        const caption = (0, params_1.asText)(this.getNodeParameter('caption', itemIndex, ''), 'Caption');
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
        const caption = (0, params_1.asText)(this.getNodeParameter('caption', itemIndex, ''), 'Caption');
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
        const locationName = (0, params_1.asText)(this.getNodeParameter('locationName', itemIndex, ''), 'Location name');
        if (locationName) {
            // OpenWA's SendLocationDto uses `description` for the location label.
            body.description = locationName;
        }
        // A separate field from the label: WhatsApp renders `description` as the place
        // name and `address` as the line under it.
        const address = (0, params_1.asText)(this.getNodeParameter('locationAddress', itemIndex, ''), 'Address');
        if (address) {
            body.address = address;
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
            quotedMessageId: (0, params_1.asText)(this.getNodeParameter('quotedMessageId', itemIndex), 'Quoted Message ID'),
            text: messageBody(this, this.getNodeParameter('message', itemIndex), itemIndex),
        };
    }
    else if (operation === 'react') {
        endpoint = `/api/sessions/${sessionId}/messages/react`;
        // An empty emoji removes the existing reaction — the field is intentionally sent.
        body = {
            chatId,
            messageId: (0, params_1.asText)(this.getNodeParameter('messageId', itemIndex), 'Message ID'),
            emoji: this.getNodeParameter('emoji', itemIndex, ''),
        };
    }
    else if (operation === 'delete') {
        endpoint = `/api/sessions/${sessionId}/messages/delete`;
        body = {
            chatId,
            messageId: (0, params_1.asText)(this.getNodeParameter('messageId', itemIndex), 'Message ID'),
            forEveryone: this.getNodeParameter('forEveryone', itemIndex, true),
        };
    }
    else if (operation === 'sendVideo') {
        endpoint = `/api/sessions/${sessionId}/messages/send-video`;
        body = { chatId };
        const caption = (0, params_1.asText)(this.getNodeParameter('caption', itemIndex, ''), 'Caption');
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
    else if (operation === 'sendPoll') {
        endpoint = `/api/sessions/${sessionId}/messages/send-poll`;
        const pollOptions = (0, params_1.toStringList)(this.getNodeParameter('pollOptions', itemIndex, ''));
        if (pollOptions.length < MIN_POLL_OPTIONS || pollOptions.length > MAX_POLL_OPTIONS) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `A poll needs between ${MIN_POLL_OPTIONS} and ${MAX_POLL_OPTIONS} options (got ${pollOptions.length})`, { itemIndex });
        }
        body = {
            chatId,
            name: (0, params_1.requireText)(this, 'pollName', 'Poll question', itemIndex, MAX_POLL_NAME_LENGTH),
            options: pollOptions,
        };
        if (this.getNodeParameter('allowMultipleAnswers', itemIndex, false)) {
            body.allowMultipleAnswers = true;
        }
    }
    else if (operation === 'sendTemplate') {
        endpoint = `/api/sessions/${sessionId}/messages/send-template`;
        body = { chatId };
        // The API takes either a template id or a template name, not both.
        const templateId = (0, params_1.asText)(this.getNodeParameter('sendTemplateId', itemIndex, ''), 'Template ID');
        const templateName = (0, params_1.asText)(this.getNodeParameter('sendTemplateName', itemIndex, ''), 'Template name');
        if (!templateId && !templateName) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Provide either a Template ID or a Template Name', { itemIndex });
        }
        if (templateId) {
            body.templateId = templateId;
        }
        else {
            body.templateName = templateName;
        }
        let parsedVars;
        try {
            parsedVars = (0, jsonParam_1.parseJsonParam)(this.getNodeParameter('templateVars', itemIndex, ''));
        }
        catch {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Template variables must be valid JSON', {
                itemIndex,
            });
        }
        if (parsedVars !== undefined) {
            if (typeof parsedVars !== 'object' || parsedVars === null || Array.isArray(parsedVars)) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Template variables must be a JSON object (e.g. {"name":"Alice"})', { itemIndex });
            }
            body.vars = parsedVars;
        }
        // Send Template renders the template and hands it to the text sender, so it
        // carries linkPreview. It does NOT declare customLinkPreview.
        applyLinkPreview.call(this, body, itemIndex);
    }
    else if (operation === 'edit') {
        endpoint = `/api/sessions/${sessionId}/messages/edit`;
        body = {
            chatId,
            messageId: (0, params_1.asText)(this.getNodeParameter('messageId', itemIndex), 'Message ID'),
            body: (0, params_1.requireText)(this, 'message', 'Message', itemIndex, MAX_EDIT_BODY_LENGTH),
        };
    }
    else if (operation === 'forward') {
        endpoint = `/api/sessions/${sessionId}/messages/forward`;
        body = {
            fromChatId: (0, params_1.requireJid)(this, 'fromChatId', 'From Chat ID', itemIndex),
            toChatId: (0, params_1.requireJid)(this, 'toChatId', 'To Chat ID', itemIndex),
            messageId: (0, params_1.asText)(this.getNodeParameter('messageId', itemIndex), 'Message ID'),
        };
        // send-catalog has no branch because the route no longer exists at all; the
        // server removed it. The catalog reads live on the Catalog resource.
    }
    else if (operation === 'pin' || operation === 'unpin') {
        endpoint = `/api/sessions/${sessionId}/messages/${operation}`;
        body = {
            chatId,
            messageId: (0, params_1.asText)(this.getNodeParameter('messageId', itemIndex), 'Message ID'),
        };
        if (operation === 'pin') {
            // UnpinMessageDto does not declare this field, so it must not ride along.
            body.durationSeconds = this.getNodeParameter('pinDurationSeconds', itemIndex, 86400);
        }
    }
    else if (operation === 'star') {
        endpoint = `/api/sessions/${sessionId}/messages/star`;
        // `star` has no server-side default: omitting it is a 400, so it is always sent.
        body = {
            chatId,
            messageId: (0, params_1.asText)(this.getNodeParameter('messageId', itemIndex), 'Message ID'),
            star: this.getNodeParameter('star', itemIndex, true),
        };
    }
    else if (operation === 'votePoll') {
        endpoint = `/api/sessions/${sessionId}/messages/vote-poll`;
        const selections = (0, params_1.toStringList)(this.getNodeParameter('pollVoteOptions', itemIndex, ''));
        if (selections.length > MAX_POLL_VOTE_OPTIONS) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `A vote can select at most ${MAX_POLL_VOTE_OPTIONS} options (got ${selections.length})`, { itemIndex });
        }
        body = {
            chatId,
            // The wire name is pollMessageId here, not messageId.
            pollMessageId: (0, params_1.asText)(this.getNodeParameter('messageId', itemIndex), 'Message ID'),
            // Always sent, including empty: omitting the key is a 400, and an empty
            // array is how a vote is cleared.
            options: selections,
        };
    }
    else if (operation === 'sendProduct') {
        endpoint = `/api/sessions/${sessionId}/messages/send-product`;
        body = {
            chatId,
            productId: (0, params_1.requireText)(this, 'productId', 'Product ID', itemIndex),
        };
        // The wire field really is called `body`, inside the request body object.
        const productBody = (0, params_1.asText)(this.getNodeParameter('productBody', itemIndex, ''), 'Body');
        if (productBody) {
            body.body = productBody;
        }
    }
    else if (operation === 'sendContact') {
        endpoint = `/api/sessions/${sessionId}/messages/send-contact`;
        body = {
            chatId,
            contactName: (0, params_1.asText)(this.getNodeParameter('contactName', itemIndex), 'Contact name'),
            contactNumber: (0, params_1.asText)(this.getNodeParameter('contactNumber', itemIndex), 'Contact number'),
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
        const batchId = (0, params_1.asText)(this.getNodeParameter('batchId', itemIndex, ''), 'Batch ID');
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
    // Optional quoted message. The quotable set and the mentions set below are
    // genuinely different: Send Location and Send Contact can quote but cannot tag,
    // and Send Template and Edit can tag but cannot quote. Neither is derived from
    // the other.
    if (QUOTABLE_SENDS.has(operation)) {
        const quoted = (0, params_1.asText)(this.getNodeParameter('sendQuotedMessageId', itemIndex, ''), 'Quoted Message ID');
        if (quoted) {
            body.quotedMessageId = quoted;
        }
    }
    // Optional @mentions. Guard by operation (not just the hidden field) so a mentions
    // value can never ride along on a request whose DTO rejects unknown fields (400),
    // such as sendLocation.
    //
    // `edit` is in this list for a different reason than the sends: EditMessageDto
    // carries `mentions` because an edit REPLACES the message content, so the tags are
    // re-applied rather than preserved. Omitting the field strips whatever the original
    // body tagged, which the server reports as a success.
    if (operation === 'sendText' ||
        operation === 'sendImage' ||
        operation === 'sendDocument' ||
        operation === 'sendVideo' ||
        operation === 'sendAudio' ||
        operation === 'sendSticker' ||
        operation === 'sendTemplate' ||
        operation === 'reply' ||
        operation === 'edit') {
        const mentions = (0, params_1.toStringList)(this.getNodeParameter('mentions', itemIndex, ''));
        if (mentions.length > 0) {
            body.mentions = mentions;
        }
    }
    return { endpoint, method: 'POST', body };
}
