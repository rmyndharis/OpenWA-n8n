import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { resolveMediaSource, type MediaParamNames } from '../media';
import { requireJid, requireText, toStringList } from './params';
import type { RequestSpec } from './types';

const STATUS_IMAGE_MEDIA: MediaParamNames = {
  source: 'statusImageSource',
  binaryProperty: 'statusImageBinaryProperty',
  url: 'statusImageUrl',
  base64: 'statusImageBase64',
  mimeType: 'statusImageMimeType',
};
const STATUS_VIDEO_MEDIA: MediaParamNames = {
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
 * The Baileys engine requires an explicit list; whatsapp-web.js posts to the
 * whole contact list when it is omitted.
 */
function getRecipients(ctx: IExecuteFunctions, itemIndex: number): string[] | undefined {
  const recipients = toStringList(ctx.getNodeParameter('statusRecipients', itemIndex, ''));
  if (recipients.length === 0) {
    return undefined;
  }
  if (recipients.length > MAX_RECIPIENTS) {
    throw new NodeOperationError(
      ctx.getNode(),
      `Recipients cannot exceed ${MAX_RECIPIENTS} entries (got ${recipients.length})`,
      { itemIndex },
    );
  }
  return recipients;
}

/** Reads the optional caption shared by the image and video send operations. */
function getCaption(ctx: IExecuteFunctions, itemIndex: number): string | undefined {
  const caption = (ctx.getNodeParameter('statusCaption', itemIndex, '') as string).trim();
  if (!caption) {
    return undefined;
  }
  if (caption.length > MAX_CAPTION_LENGTH) {
    throw new NodeOperationError(
      ctx.getNode(),
      `Caption cannot exceed ${MAX_CAPTION_LENGTH} characters`,
      { itemIndex },
    );
  }
  return caption;
}

/**
 * WhatsApp Status (stories) — reading the status feed and posting text, image,
 * or video updates.
 */
export async function buildStatusRequest(
  this: IExecuteFunctions,
  operation: string,
  itemIndex: number,
): Promise<RequestSpec | null> {
  const sessionId = sanitizePathParam(
    this.getNodeParameter('sessionId', itemIndex) as string,
    'Session ID',
  );
  const base = `/api/sessions/${sessionId}/status`;

  switch (operation) {
    case 'list':
      return { endpoint: base, method: 'GET', body: {} };

    case 'getByContact': {
      const contactId = encodeURIComponent(
        requireJid(this, 'statusContactId', 'Contact ID', itemIndex),
      );
      return { endpoint: `${base}/${contactId}`, method: 'GET', body: {} };
    }

    case 'getMedia': {
      const statusId = sanitizePathParam(
        this.getNodeParameter('statusId', itemIndex) as string,
        'Status ID',
      );
      // The route streams the stored image or video bytes, not JSON.
      return {
        endpoint: `${base}/${statusId}/media`,
        method: 'GET',
        body: {},
        responseFormat: 'binary',
      };
    }

    case 'delete': {
      const statusId = sanitizePathParam(
        this.getNodeParameter('statusId', itemIndex) as string,
        'Status ID',
      );
      return { endpoint: `${base}/${statusId}`, method: 'DELETE', body: {} };
    }

    case 'sendText': {
      const body: Record<string, unknown> = {
        text: requireText(this, 'statusText', 'Status text', itemIndex, MAX_TEXT_LENGTH),
      };
      const backgroundColor = (
        this.getNodeParameter('statusBackgroundColor', itemIndex, '') as string
      ).trim();
      if (backgroundColor) {
        body.backgroundColor = backgroundColor;
      }
      const font = this.getNodeParameter('statusFont', itemIndex, -1) as number;
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

    case 'sendImage':
    case 'sendVideo': {
      const isImage = operation === 'sendImage';
      // The media object nests under `image` / `video` rather than sitting flat
      // on the body, unlike the message send-* routes.
      const media = await resolveMediaSource.call(
        this,
        itemIndex,
        isImage ? STATUS_IMAGE_MEDIA : STATUS_VIDEO_MEDIA,
        isImage ? 'image/jpeg' : 'video/mp4',
      );
      const body: Record<string, unknown> = { [isImage ? 'image' : 'video']: media };
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
