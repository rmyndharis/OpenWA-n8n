import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { parseBulkMessages } from '../bulkMessages';
import { resolveMediaSource, type MediaParamNames } from '../media';
import { requireJid, requireText, toQueryParams, toStringList, asText } from './params';
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

/**
 * Three states, which a boolean cannot express: leave it to the engine, ask for a
 * preview, or suppress one. The engines disagree about what "leave it" means, so the
 * distinction is real. On whatsapp-web.js a preview is built by default and only an
 * explicit false is forwarded; on Baileys previews are opt-in, and asking for one
 * costs a blocking fetch of every URL in the message before the send goes out.
 */
function applyLinkPreview(
  this: IExecuteFunctions,
  body: Record<string, unknown>,
  itemIndex: number,
): void {
  const choice = this.getNodeParameter('linkPreview', itemIndex, 'default') as string;
  if (choice === 'yes') {
    body.linkPreview = true;
  } else if (choice === 'no') {
    body.linkPreview = false;
  }
}

/**
 * A caller-supplied preview card, or undefined when the user opened the collection
 * without filling it in. An n8n collection yields `{}` as soon as it is opened, and
 * the server refuses that, so the object is rebuilt from the trimmed values instead
 * of being forwarded as-is.
 */
function readCustomLinkPreview(
  this: IExecuteFunctions,
  itemIndex: number,
): Record<string, string> | undefined {
  const fields = this.getNodeParameter('customLinkPreview', itemIndex, {}) as {
    previewUrl?: string;
    previewTitle?: string;
    previewDescription?: string;
  };
  const url = (fields.previewUrl ?? '').trim();
  const title = (fields.previewTitle ?? '').trim();
  if (!url || !title) {
    return undefined;
  }
  const preview: Record<string, string> = { url, title };
  const description = (fields.previewDescription ?? '').trim();
  if (description) {
    preview.description = description;
  }
  return preview;
}

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
    chatId = asText(this.getNodeParameter('chatId', itemIndex));
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
    const messageId = asText(this.getNodeParameter('messageId', itemIndex));
    if (!messageId) {
      throw new NodeOperationError(this.getNode(), 'Message ID cannot be empty', { itemIndex });
    }
    return {
      endpoint: `/api/sessions/${sessionId}/messages/${encodeURIComponent(chatId)}/${encodeURIComponent(messageId)}/reactions`,
      method: 'GET',
      body: {},
    };
  }

  if (operation === 'getMedia') {
    const messageId = asText(this.getNodeParameter('messageId', itemIndex));
    if (!messageId) {
      throw new NodeOperationError(this.getNode(), 'Message ID cannot be empty', { itemIndex });
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
  let body: Record<string, unknown> = {};

  if (operation === 'sendText') {
    endpoint = `/api/sessions/${sessionId}/messages/send-text`;
    body = {
      chatId,
      text: this.getNodeParameter('message', itemIndex) as string,
    };
    applyLinkPreview.call(this, body, itemIndex);
    const preview = readCustomLinkPreview.call(this, itemIndex);
    if (preview) {
      // The server refuses exactly this pair. `true` plus a custom preview is fine,
      // and so is a custom preview with no linkPreview at all.
      if (body.linkPreview === false) {
        throw new NodeOperationError(
          this.getNode(),
          'A Custom Link Preview cannot be combined with Link Preview set to No Preview',
          { itemIndex },
        );
      }
      body.customLinkPreview = preview;
    }
  } else if (operation === 'sendImage') {
    endpoint = `/api/sessions/${sessionId}/messages/send-image`;
    body = { chatId };
    const caption = asText(this.getNodeParameter('caption', itemIndex, ''));
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
    const caption = asText(this.getNodeParameter('caption', itemIndex, ''));
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
    const locationName = asText(this.getNodeParameter('locationName', itemIndex, ''));
    if (locationName) {
      // OpenWA's SendLocationDto uses `description` for the location label.
      body.description = locationName;
    }
    // A separate field from the label: WhatsApp renders `description` as the place
    // name and `address` as the line under it.
    const address = asText(this.getNodeParameter('locationAddress', itemIndex, ''));
    if (address) {
      body.address = address;
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
      quotedMessageId: asText(this.getNodeParameter('quotedMessageId', itemIndex)),
      text: this.getNodeParameter('message', itemIndex) as string,
    };
  } else if (operation === 'react') {
    endpoint = `/api/sessions/${sessionId}/messages/react`;
    // An empty emoji removes the existing reaction — the field is intentionally sent.
    body = {
      chatId,
      messageId: asText(this.getNodeParameter('messageId', itemIndex)),
      emoji: this.getNodeParameter('emoji', itemIndex, '') as string,
    };
  } else if (operation === 'delete') {
    endpoint = `/api/sessions/${sessionId}/messages/delete`;
    body = {
      chatId,
      messageId: asText(this.getNodeParameter('messageId', itemIndex)),
      forEveryone: this.getNodeParameter('forEveryone', itemIndex, true) as boolean,
    };
  } else if (operation === 'sendVideo') {
    endpoint = `/api/sessions/${sessionId}/messages/send-video`;
    body = { chatId };
    const caption = asText(this.getNodeParameter('caption', itemIndex, ''));
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
    const templateId = asText(this.getNodeParameter('sendTemplateId', itemIndex, ''));
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
    // Send Template renders the template and hands it to the text sender, so it
    // carries linkPreview. It does NOT declare customLinkPreview.
    applyLinkPreview.call(this, body, itemIndex);
  } else if (operation === 'edit') {
    endpoint = `/api/sessions/${sessionId}/messages/edit`;
    body = {
      chatId,
      messageId: asText(this.getNodeParameter('messageId', itemIndex)),
      body: requireText(this, 'message', 'Message', itemIndex, MAX_EDIT_BODY_LENGTH),
    };
  } else if (operation === 'forward') {
    endpoint = `/api/sessions/${sessionId}/messages/forward`;
    body = {
      fromChatId: requireJid(this, 'fromChatId', 'From Chat ID', itemIndex),
      toChatId: requireJid(this, 'toChatId', 'To Chat ID', itemIndex),
      messageId: asText(this.getNodeParameter('messageId', itemIndex)),
    };
    // send-catalog has no branch because the route no longer exists at all; the
    // server removed it. The catalog reads live on the Catalog resource.
  } else if (operation === 'pin' || operation === 'unpin') {
    endpoint = `/api/sessions/${sessionId}/messages/${operation}`;
    body = {
      chatId,
      messageId: asText(this.getNodeParameter('messageId', itemIndex)),
    };
    if (operation === 'pin') {
      // UnpinMessageDto does not declare this field, so it must not ride along.
      body.durationSeconds = this.getNodeParameter(
        'pinDurationSeconds',
        itemIndex,
        86400,
      ) as number;
    }
  } else if (operation === 'star') {
    endpoint = `/api/sessions/${sessionId}/messages/star`;
    // `star` has no server-side default: omitting it is a 400, so it is always sent.
    body = {
      chatId,
      messageId: asText(this.getNodeParameter('messageId', itemIndex)),
      star: this.getNodeParameter('star', itemIndex, true) as boolean,
    };
  } else if (operation === 'votePoll') {
    endpoint = `/api/sessions/${sessionId}/messages/vote-poll`;
    const selections = toStringList(this.getNodeParameter('pollVoteOptions', itemIndex, ''));
    if (selections.length > MAX_POLL_VOTE_OPTIONS) {
      throw new NodeOperationError(
        this.getNode(),
        `A vote can select at most ${MAX_POLL_VOTE_OPTIONS} options (got ${selections.length})`,
        { itemIndex },
      );
    }
    body = {
      chatId,
      // The wire name is pollMessageId here, not messageId.
      pollMessageId: asText(this.getNodeParameter('messageId', itemIndex)),
      // Always sent, including empty: omitting the key is a 400, and an empty
      // array is how a vote is cleared.
      options: selections,
    };
  } else if (operation === 'sendProduct') {
    endpoint = `/api/sessions/${sessionId}/messages/send-product`;
    body = {
      chatId,
      productId: requireText(this, 'productId', 'Product ID', itemIndex),
    };
    // The wire field really is called `body`, inside the request body object.
    const productBody = asText(this.getNodeParameter('productBody', itemIndex, ''));
    if (productBody) {
      body.body = productBody;
    }
  } else if (operation === 'sendContact') {
    endpoint = `/api/sessions/${sessionId}/messages/send-contact`;
    body = {
      chatId,
      contactName: asText(this.getNodeParameter('contactName', itemIndex)),
      contactNumber: asText(this.getNodeParameter('contactNumber', itemIndex)),
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
    const batchId = asText(this.getNodeParameter('batchId', itemIndex, ''));
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

  // Optional quoted message. The quotable set and the mentions set below are
  // genuinely different: Send Location and Send Contact can quote but cannot tag,
  // and Send Template and Edit can tag but cannot quote. Neither is derived from
  // the other.
  if (QUOTABLE_SENDS.has(operation)) {
    const quoted = asText(this.getNodeParameter('sendQuotedMessageId', itemIndex, ''));
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
  if (
    operation === 'sendText' ||
    operation === 'sendImage' ||
    operation === 'sendDocument' ||
    operation === 'sendVideo' ||
    operation === 'sendAudio' ||
    operation === 'sendSticker' ||
    operation === 'sendTemplate' ||
    operation === 'reply' ||
    operation === 'edit'
  ) {
    const mentions = toStringList(this.getNodeParameter('mentions', itemIndex, ''));
    if (mentions.length > 0) {
      body.mentions = mentions;
    }
  }

  return { endpoint, method: 'POST', body };
}
