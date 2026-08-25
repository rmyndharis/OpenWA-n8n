import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { parseBulkMessages } from '../bulkMessages';
import { resolveMediaSource, type MediaParamNames } from '../media';
import { requireJid, requireText, toQueryParams, toStringList } from './params';
import type { RequestSpec } from './types';

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

const IMAGE_MEDIA: MediaParamNames = {
  source: 'imageSource',
  binaryProperty: 'imageBinaryProperty',
  url: 'imageUrl',
  base64: 'imageBase64',
  mimeType: 'imageMimeType',
};
const DOCUMENT_MEDIA: MediaParamNames = {
  source: 'documentSource',
  binaryProperty: 'documentBinaryProperty',
  url: 'documentUrl',
  base64: 'documentBase64',
  mimeType: 'documentMimeType',
};
const AUDIO_MEDIA: MediaParamNames = {
  source: 'audioSource',
  binaryProperty: 'audioBinaryProperty',
  url: 'audioUrl',
  base64: 'audioBase64',
  mimeType: 'audioMimeType',
};
const VIDEO_MEDIA: MediaParamNames = {
  source: 'videoSource',
  binaryProperty: 'videoBinaryProperty',
  url: 'videoUrl',
  base64: 'videoBase64',
  mimeType: 'videoMimeType',
};
const STICKER_MEDIA: MediaParamNames = {
  source: 'stickerSource',
  binaryProperty: 'stickerBinaryProperty',
  url: 'stickerUrl',
  base64: 'stickerBase64',
  mimeType: 'stickerMimeType',
};

export async function buildMessageRequest(
  this: IExecuteFunctions,
  operation: string,
  itemIndex: number,
): Promise<RequestSpec | null> {
  const sessionId = sanitizePathParam(
    this.getNodeParameter('sessionId', itemIndex) as string,
    'Session ID',
  );
  // Bulk / batch operations are not addressed to a single chat, and Forward and
  // List name their chats through their own fields, so all of them skip Chat ID.
  let chatId = '';
  if (!CHATLESS_OPERATIONS.has(operation)) {
    chatId = (this.getNodeParameter('chatId', itemIndex) as string).trim();
    if (!chatId) {
      throw new NodeOperationError(this.getNode(), 'Chat ID cannot be empty', {
        itemIndex,
      });
    }
  }

  // --- Reads -----------------------------------------------------------------

  if (operation === 'list') {
    const options = this.getNodeParameter('messageListOptions', itemIndex, {}) as IDataObject;
    return {
      endpoint: `/api/sessions/${sessionId}/messages`,
      method: 'GET',
      body: {},
      qs: toQueryParams(options),
    };
  }

  if (operation === 'getHistory') {
    const options = this.getNodeParameter('historyOptions', itemIndex, {}) as IDataObject;
    return {
      endpoint: `/api/sessions/${sessionId}/messages/${encodeURIComponent(chatId)}/history`,
      method: 'GET',
      body: {},
      qs: toQueryParams(options),
    };
  }

  if (operation === 'getReactions') {
    const messageId = (this.getNodeParameter('messageId', itemIndex) as string).trim();
    if (!messageId) {
      throw new NodeOperationError(this.getNode(), 'Message ID cannot be empty', { itemIndex });
    }
    return {
      endpoint: `/api/sessions/${sessionId}/messages/${encodeURIComponent(chatId)}/${encodeURIComponent(messageId)}/reactions`,
      method: 'GET',
      body: {},
    };
  }

  let endpoint = '';
  let body: Record<string, unknown> = {};

  if (operation === 'sendText') {
    endpoint = `/api/sessions/${sessionId}/messages/send-text`;
    body = {
      chatId,
      text: this.getNodeParameter('message', itemIndex) as string,
    };
  } else if (operation === 'sendImage') {
    endpoint = `/api/sessions/${sessionId}/messages/send-image`;
    body = { chatId };
    const caption = (this.getNodeParameter('caption', itemIndex, '') as string).trim();
    if (caption) {
      body.caption = caption;
    }
    // OpenWA rejects base64 without a mimetype; fall back to the server's own
    // default if the binary item somehow carries no MIME type.
    Object.assign(
      body,
      await resolveMediaSource.call(this, itemIndex, IMAGE_MEDIA, 'application/octet-stream'),
    );
  } else if (operation === 'sendDocument') {
    endpoint = `/api/sessions/${sessionId}/messages/send-document`;
    body = {
      chatId,
      filename: this.getNodeParameter('filename', itemIndex, 'document.pdf') as string,
    };
    const caption = (this.getNodeParameter('caption', itemIndex, '') as string).trim();
    if (caption) {
      body.caption = caption;
    }
    Object.assign(
      body,
      await resolveMediaSource.call(this, itemIndex, DOCUMENT_MEDIA, 'application/octet-stream'),
    );
  } else if (operation === 'sendLocation') {
    endpoint = `/api/sessions/${sessionId}/messages/send-location`;
    body = {
      chatId,
      latitude: this.getNodeParameter('latitude', itemIndex) as number,
      longitude: this.getNodeParameter('longitude', itemIndex) as number,
    };
    const locationName = (this.getNodeParameter('locationName', itemIndex, '') as string).trim();
    if (locationName) {
      // OpenWA's SendLocationDto uses `description` for the location label.
      body.description = locationName;
    }
  } else if (operation === 'sendAudio') {
    endpoint = `/api/sessions/${sessionId}/messages/send-audio`;
    body = { chatId };
    // Fall back to the voice-note format if the binary item carries no MIME type.
    Object.assign(
      body,
      await resolveMediaSource.call(this, itemIndex, AUDIO_MEDIA, 'audio/ogg; codecs=opus'),
    );
    // Deliver as a true WhatsApp voice note (PTT). Only attach `ptt` when enabled so
    // plain-audio sends stay backward-compatible; the field requires server >= v0.7.17.
    if (this.getNodeParameter('sendAsVoiceNote', itemIndex, false) as boolean) {
      body.ptt = true;
    }
  } else if (operation === 'reply') {
    endpoint = `/api/sessions/${sessionId}/messages/reply`;
    body = {
      chatId,
      quotedMessageId: (this.getNodeParameter('quotedMessageId', itemIndex) as string).trim(),
      text: this.getNodeParameter('message', itemIndex) as string,
    };
  } else if (operation === 'react') {
    endpoint = `/api/sessions/${sessionId}/messages/react`;
    // An empty emoji removes the existing reaction — the field is intentionally sent.
    body = {
      chatId,
      messageId: (this.getNodeParameter('messageId', itemIndex) as string).trim(),
      emoji: this.getNodeParameter('emoji', itemIndex, '') as string,
    };
  } else if (operation === 'delete') {
    endpoint = `/api/sessions/${sessionId}/messages/delete`;
    body = {
      chatId,
      messageId: (this.getNodeParameter('messageId', itemIndex) as string).trim(),
      forEveryone: this.getNodeParameter('forEveryone', itemIndex, true) as boolean,
    };
  } else if (operation === 'sendVideo') {
    endpoint = `/api/sessions/${sessionId}/messages/send-video`;
    body = { chatId };
    const caption = (this.getNodeParameter('caption', itemIndex, '') as string).trim();
    if (caption) {
      body.caption = caption;
    }
    Object.assign(
      body,
      await resolveMediaSource.call(this, itemIndex, VIDEO_MEDIA, 'application/octet-stream'),
    );
  } else if (operation === 'sendSticker') {
    endpoint = `/api/sessions/${sessionId}/messages/send-sticker`;
    body = { chatId };
    // Stickers must be WebP; fall back to that if the binary item carries no MIME type.
    Object.assign(
      body,
      await resolveMediaSource.call(this, itemIndex, STICKER_MEDIA, 'image/webp'),
    );
  } else if (operation === 'sendPoll') {
    endpoint = `/api/sessions/${sessionId}/messages/send-poll`;
    const pollOptions = toStringList(this.getNodeParameter('pollOptions', itemIndex, ''));
    if (pollOptions.length < MIN_POLL_OPTIONS || pollOptions.length > MAX_POLL_OPTIONS) {
      throw new NodeOperationError(
        this.getNode(),
        `A poll needs between ${MIN_POLL_OPTIONS} and ${MAX_POLL_OPTIONS} options (got ${pollOptions.length})`,
        { itemIndex },
      );
    }
    body = {
      chatId,
      name: requireText(this, 'pollName', 'Poll question', itemIndex, MAX_POLL_NAME_LENGTH),
      options: pollOptions,
    };
    if (this.getNodeParameter('allowMultipleAnswers', itemIndex, false) as boolean) {
      body.allowMultipleAnswers = true;
    }
  } else if (operation === 'sendTemplate') {
    endpoint = `/api/sessions/${sessionId}/messages/send-template`;
    body = { chatId };
    // The API takes either a template id or a template name, not both.
    const templateId = (this.getNodeParameter('sendTemplateId', itemIndex, '') as string).trim();
    const templateName = (
      this.getNodeParameter('sendTemplateName', itemIndex, '') as string
    ).trim();
    if (!templateId && !templateName) {
      throw new NodeOperationError(
        this.getNode(),
        'Provide either a Template ID or a Template Name',
        { itemIndex },
      );
    }
    if (templateId) {
      body.templateId = templateId;
    } else {
      body.templateName = templateName;
    }
    const rawVars = this.getNodeParameter('templateVars', itemIndex, '') as
      | string
      | Record<string, unknown>;
    if (rawVars !== '' && rawVars !== undefined && rawVars !== null) {
      let parsedVars: unknown;
      try {
        parsedVars = typeof rawVars === 'string' ? JSON.parse(rawVars) : rawVars;
      } catch {
        throw new NodeOperationError(this.getNode(), 'Template variables must be valid JSON', {
          itemIndex,
        });
      }
      if (typeof parsedVars !== 'object' || parsedVars === null || Array.isArray(parsedVars)) {
        throw new NodeOperationError(
          this.getNode(),
          'Template variables must be a JSON object (e.g. {"name":"Alice"})',
          { itemIndex },
        );
      }
      body.vars = parsedVars;
    }
  } else if (operation === 'edit') {
    endpoint = `/api/sessions/${sessionId}/messages/edit`;
    body = {
      chatId,
      messageId: (this.getNodeParameter('messageId', itemIndex) as string).trim(),
      body: requireText(this, 'message', 'Message', itemIndex, MAX_EDIT_BODY_LENGTH),
    };
  } else if (operation === 'forward') {
    endpoint = `/api/sessions/${sessionId}/messages/forward`;
    body = {
      fromChatId: requireJid(this, 'fromChatId', 'From Chat ID', itemIndex),
      toChatId: requireJid(this, 'toChatId', 'To Chat ID', itemIndex),
      messageId: (this.getNodeParameter('messageId', itemIndex) as string).trim(),
    };
    // send-product and the Catalog reads are absent because they are Baileys-only:
    // each answers 501 on whatsapp-web.js, and send-product returns `{id, timestamp}`
    // rather than the `{messageId, timestamp}` every other send returns, so it cannot
    // share their output shape. send-catalog is absent because the route no longer
    // exists at all; the server removed it.
  } else if (operation === 'sendContact') {
    endpoint = `/api/sessions/${sessionId}/messages/send-contact`;
    body = {
      chatId,
      contactName: (this.getNodeParameter('contactName', itemIndex) as string).trim(),
      contactNumber: (this.getNodeParameter('contactNumber', itemIndex) as string).trim(),
    };
  } else if (operation === 'sendBulk') {
    endpoint = `/api/sessions/${sessionId}/messages/send-bulk`;
    let messages: unknown[];
    try {
      messages = parseBulkMessages(this.getNodeParameter('bulkMessages', itemIndex, '[]'));
    } catch (e) {
      throw new NodeOperationError(this.getNode(), (e as Error).message, { itemIndex });
    }
    body = { messages };
    const batchId = (this.getNodeParameter('batchId', itemIndex, '') as string).trim();
    if (batchId) {
      body.batchId = batchId;
    }
    const options = this.getNodeParameter('bulkOptions', itemIndex, {}) as Record<string, unknown>;
    if (Object.keys(options).length > 0) {
      body.options = options;
    }
  } else if (operation === 'getBatchStatus') {
    const batchId = sanitizePathParam(
      this.getNodeParameter('statusBatchId', itemIndex) as string,
      'Batch ID',
    );
    return {
      endpoint: `/api/sessions/${sessionId}/messages/batch/${batchId}`,
      method: 'GET',
      body: {},
    };
  } else if (operation === 'cancelBatch') {
    const batchId = sanitizePathParam(
      this.getNodeParameter('statusBatchId', itemIndex) as string,
      'Batch ID',
    );
    return {
      endpoint: `/api/sessions/${sessionId}/messages/batch/${batchId}/cancel`,
      method: 'POST',
      body: {},
    };
  } else {
    return null;
  }

  // Optional @mentions. Guard by operation (not just the hidden field) so a mentions
  // value can never ride along on a request whose DTO rejects unknown fields (400),
  // such as sendLocation.
  //
  // `edit` is in this list for a different reason than the sends: EditMessageDto
  // carries `mentions` because an edit REPLACES the message content, so the tags are
  // re-applied rather than preserved. Omitting the field strips whatever the original
  // body tagged, which the server reports as a success.
  if (
    operation === 'sendText' ||
    operation === 'sendImage' ||
    operation === 'sendDocument' ||
    operation === 'sendVideo' ||
    operation === 'edit'
  ) {
    const mentions = toStringList(this.getNodeParameter('mentions', itemIndex, ''));
    if (mentions.length > 0) {
      body.mentions = mentions;
    }
  }

  return { endpoint, method: 'POST', body };
}
