import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IHttpRequestOptions,
  JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { buildContactRequest } from './handlers/contact';
import { buildMessageRequest } from './handlers/message';
import { buildSessionRequest } from './handlers/session';
import { buildWebhookRequest } from './handlers/webhook';
import type { RequestSpec } from './handlers/types';

export class OpenWa implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'OpenWA',
    name: 'openWa',
    icon: 'file:openwa.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Interact with OpenWA WhatsApp API Gateway',
    defaults: {
      name: 'OpenWA',
    },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: 'openWaApi',
        required: true,
      },
    ],
    properties: [
      // Resource
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Contact', value: 'contact' },
          { name: 'Message', value: 'message' },
          { name: 'Session', value: 'session' },
          { name: 'Webhook', value: 'webhook' },
        ],
        default: 'message',
      },

      // ============== SESSION OPERATIONS ==============
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: { resource: ['session'] },
        },
        options: [
          { name: 'Create', value: 'create', action: 'Create a new session' },
          { name: 'Delete', value: 'delete', action: 'Delete a session' },
          { name: 'Force Kill', value: 'forceKill', action: 'Force kill a stuck session' },
          { name: 'Get QR', value: 'getQr', action: 'Get the QR code for authentication' },
          { name: 'Get Status', value: 'getStatus', action: 'Get session status' },
          { name: 'List All', value: 'listAll', action: 'List all sessions' },
          { name: 'Request Pairing Code', value: 'requestPairingCode', action: 'Request a phone pairing code' },
          { name: 'Start', value: 'start', action: 'Start a session' },
          { name: 'Stop', value: 'stop', action: 'Stop a session' },
        ],
        default: 'getStatus',
      },
      {
        displayName: 'Session ID',
        name: 'sessionId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            resource: ['session'],
            operation: ['getStatus', 'start', 'stop', 'forceKill', 'delete', 'getQr', 'requestPairingCode'],
          },
        },
        description: 'The UUID of the session (returned by Create / Get Status / List All)',
      },
      {
        displayName: 'Session Name',
        name: 'sessionName',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { resource: ['session'], operation: ['create'] },
        },
        description: 'Unique name for the session (3–50 chars; letters, numbers, and hyphens only)',
      },
      {
        displayName: 'Session Config (JSON)',
        name: 'sessionConfig',
        type: 'json',
        default: '',
        displayOptions: {
          show: { resource: ['session'], operation: ['create'] },
        },
        description: 'Optional session config as a JSON object, e.g. {"autoReconnect":true}',
      },
      {
        displayName: 'Phone Number',
        name: 'pairingPhoneNumber',
        type: 'string',
        default: '',
        required: true,
        placeholder: '628123456789',
        displayOptions: {
          show: { resource: ['session'], operation: ['requestPairingCode'] },
        },
        description: 'Phone number to link, digits only in international format (e.g. 628123456789)',
      },

      // ============== MESSAGE OPERATIONS ==============
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: { resource: ['message'] },
        },
        options: [
          { name: 'Cancel Batch', value: 'cancelBatch', action: 'Cancel a bulk batch' },
          { name: 'Delete', value: 'delete', action: 'Delete a message' },
          { name: 'Get Batch Status', value: 'getBatchStatus', action: 'Get bulk batch status' },
          { name: 'React', value: 'react', action: 'React to a message' },
          { name: 'Reply', value: 'reply', action: 'Reply to a message' },
          { name: 'Send Audio', value: 'sendAudio', action: 'Send an audio or voice message' },
          { name: 'Send Bulk', value: 'sendBulk', action: 'Send messages in bulk' },
          { name: 'Send Contact', value: 'sendContact', action: 'Send a contact card' },
          { name: 'Send Document', value: 'sendDocument', action: 'Send a document' },
          { name: 'Send Image', value: 'sendImage', action: 'Send an image' },
          { name: 'Send Location', value: 'sendLocation', action: 'Send a location' },
          { name: 'Send Sticker', value: 'sendSticker', action: 'Send a sticker' },
          { name: 'Send Text', value: 'sendText', action: 'Send a text message' },
          { name: 'Send Video', value: 'sendVideo', action: 'Send a video' },
        ],
        default: 'sendText',
      },
      {
        displayName: 'Session ID',
        name: 'sessionId',
        type: 'string',
        default: 'default',
        required: true,
        displayOptions: {
          show: { resource: ['message'] },
        },
        description: 'The ID of the session to send from',
      },
      {
        displayName: 'Chat ID',
        name: 'chatId',
        type: 'string',
        default: '',
        required: true,
        placeholder: '628123456789@c.us',
        displayOptions: {
          show: {
            resource: ['message'],
            operation: [
              'sendText',
              'sendImage',
              'sendVideo',
              'sendDocument',
              'sendAudio',
              'sendLocation',
              'sendSticker',
              'sendContact',
              'reply',
              'react',
              'delete',
            ],
          },
        },
        description: 'The recipient chat ID (e.g., 628123456789@c.us for personal, or ...@g.us for groups)',
      },
      // Send Text fields
      {
        displayName: 'Message',
        name: 'message',
        type: 'string',
        typeOptions: {
          rows: 4,
        },
        default: '',
        required: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['sendText', 'reply'] },
        },
        description: 'The text message to send',
      },
      // Send Image fields
      {
        displayName: 'Image Source',
        name: 'imageSource',
        type: 'options',
        options: [
          { name: 'Binary Data', value: 'binary' },
          { name: 'URL', value: 'url' },
          { name: 'Base64', value: 'base64' },
        ],
        default: 'url',
        displayOptions: {
          show: { resource: ['message'], operation: ['sendImage'] },
        },
      },
      {
        displayName: 'Binary Property',
        name: 'imageBinaryProperty',
        type: 'string',
        default: 'data',
        required: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['sendImage'], imageSource: ['binary'] },
        },
        description: 'Name of the binary property containing the image',
      },
      {
        displayName: 'Image URL',
        name: 'imageUrl',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['sendImage'], imageSource: ['url'] },
        },
        description: 'URL of the image to send',
      },
      {
        displayName: 'Base64 Data',
        name: 'imageBase64',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['sendImage'], imageSource: ['base64'] },
        },
        description: 'Base64 encoded image data',
      },
      {
        displayName: 'MIME Type',
        name: 'imageMimeType',
        type: 'string',
        default: 'image/jpeg',
        required: true,
        placeholder: 'image/png',
        displayOptions: {
          show: { resource: ['message'], operation: ['sendImage'], imageSource: ['base64'] },
        },
        description: 'MIME type of the base64 image. OpenWA requires this whenever base64 data is sent.',
      },
      {
        displayName: 'Caption',
        name: 'caption',
        type: 'string',
        default: '',
        displayOptions: {
          show: { resource: ['message'], operation: ['sendImage', 'sendDocument', 'sendVideo'] },
        },
        description: 'Optional caption for the media',
      },
      // Send Document fields
      {
        displayName: 'Document Source',
        name: 'documentSource',
        type: 'options',
        options: [
          { name: 'Binary Data', value: 'binary' },
          { name: 'URL', value: 'url' },
          { name: 'Base64', value: 'base64' },
        ],
        default: 'url',
        displayOptions: {
          show: { resource: ['message'], operation: ['sendDocument'] },
        },
      },
      {
        displayName: 'Binary Property',
        name: 'documentBinaryProperty',
        type: 'string',
        default: 'data',
        required: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['sendDocument'], documentSource: ['binary'] },
        },
        description: 'Name of the binary property containing the document',
      },
      {
        displayName: 'Document URL',
        name: 'documentUrl',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['sendDocument'], documentSource: ['url'] },
        },
        description: 'URL of the document to send',
      },
      {
        displayName: 'Base64 Data',
        name: 'documentBase64',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['sendDocument'], documentSource: ['base64'] },
        },
        description: 'Base64 encoded document data',
      },
      {
        displayName: 'MIME Type',
        name: 'documentMimeType',
        type: 'string',
        default: 'application/pdf',
        required: true,
        placeholder: 'application/pdf',
        displayOptions: {
          show: { resource: ['message'], operation: ['sendDocument'], documentSource: ['base64'] },
        },
        description:
          'MIME type of the base64 document. OpenWA requires this whenever base64 data is sent.',
      },
      {
        displayName: 'Filename',
        name: 'filename',
        type: 'string',
        default: 'document.pdf',
        displayOptions: {
          show: { resource: ['message'], operation: ['sendDocument'] },
        },
        description: 'Filename for the document',
      },
      // Send Audio fields
      {
        displayName: 'Audio Source',
        name: 'audioSource',
        type: 'options',
        options: [
          { name: 'Binary Data', value: 'binary' },
          { name: 'URL', value: 'url' },
          { name: 'Base64', value: 'base64' },
        ],
        default: 'url',
        displayOptions: {
          show: { resource: ['message'], operation: ['sendAudio'] },
        },
      },
      {
        displayName: 'Binary Property',
        name: 'audioBinaryProperty',
        type: 'string',
        default: 'data',
        required: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['sendAudio'], audioSource: ['binary'] },
        },
        description: 'Name of the binary property containing the audio',
      },
      {
        displayName: 'Audio URL',
        name: 'audioUrl',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['sendAudio'], audioSource: ['url'] },
        },
        description: 'URL of the audio to send',
      },
      {
        displayName: 'Base64 Data',
        name: 'audioBase64',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['sendAudio'], audioSource: ['base64'] },
        },
        description: 'Base64 encoded audio data',
      },
      {
        displayName: 'MIME Type',
        name: 'audioMimeType',
        type: 'string',
        default: 'audio/ogg; codecs=opus',
        required: true,
        placeholder: 'audio/ogg; codecs=opus',
        displayOptions: {
          show: { resource: ['message'], operation: ['sendAudio'], audioSource: ['base64'] },
        },
        description:
          'MIME type of the base64 audio. OpenWA requires this whenever base64 data is sent. Use audio/ogg; codecs=opus for a voice note; for a plain audio file set its real type (e.g. audio/mpeg).',
      },
      {
        displayName: 'Send as Voice Note',
        name: 'sendAsVoiceNote',
        type: 'boolean',
        default: false,
        displayOptions: {
          show: { resource: ['message'], operation: ['sendAudio'] },
        },
        description:
          'Whether to deliver this as a true WhatsApp voice note (PTT — mic bubble with a waveform) instead of a plain audio file. Requires OGG/Opus audio (audio/ogg; codecs=opus) and an OpenWA server ≥ v0.7.17; leave off on older servers.',
      },
      // Send Location fields
      {
        displayName: 'Latitude',
        name: 'latitude',
        type: 'number',
        default: 0,
        required: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['sendLocation'] },
        },
        description: 'Latitude coordinate',
      },
      {
        displayName: 'Longitude',
        name: 'longitude',
        type: 'number',
        default: 0,
        required: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['sendLocation'] },
        },
        description: 'Longitude coordinate',
      },
      {
        displayName: 'Location Name',
        name: 'locationName',
        type: 'string',
        default: '',
        displayOptions: {
          show: { resource: ['message'], operation: ['sendLocation'] },
        },
        description: 'Name of the location',
      },
      // Send Video fields
      {
        displayName: 'Video Source',
        name: 'videoSource',
        type: 'options',
        options: [
          { name: 'Binary Data', value: 'binary' },
          { name: 'URL', value: 'url' },
          { name: 'Base64', value: 'base64' },
        ],
        default: 'url',
        displayOptions: { show: { resource: ['message'], operation: ['sendVideo'] } },
      },
      {
        displayName: 'Binary Property',
        name: 'videoBinaryProperty',
        type: 'string',
        default: 'data',
        required: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['sendVideo'], videoSource: ['binary'] },
        },
        description: 'Name of the binary property containing the video',
      },
      {
        displayName: 'Video URL',
        name: 'videoUrl',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['sendVideo'], videoSource: ['url'] },
        },
        description: 'URL of the video to send',
      },
      {
        displayName: 'Base64 Data',
        name: 'videoBase64',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['sendVideo'], videoSource: ['base64'] },
        },
        description: 'Base64 encoded video data',
      },
      {
        displayName: 'MIME Type',
        name: 'videoMimeType',
        type: 'string',
        default: 'video/mp4',
        required: true,
        placeholder: 'video/mp4',
        displayOptions: {
          show: { resource: ['message'], operation: ['sendVideo'], videoSource: ['base64'] },
        },
        description: 'MIME type of the base64 video. OpenWA requires this whenever base64 data is sent.',
      },
      // Send Sticker fields (WhatsApp expects WebP; the engine ignores caption/mentions here)
      {
        displayName: 'Sticker Source',
        name: 'stickerSource',
        type: 'options',
        options: [
          { name: 'Binary Data', value: 'binary' },
          { name: 'URL', value: 'url' },
          { name: 'Base64', value: 'base64' },
        ],
        default: 'url',
        displayOptions: { show: { resource: ['message'], operation: ['sendSticker'] } },
      },
      {
        displayName: 'Binary Property',
        name: 'stickerBinaryProperty',
        type: 'string',
        default: 'data',
        required: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['sendSticker'], stickerSource: ['binary'] },
        },
        description: 'Name of the binary property containing the sticker (ideally WebP, 512×512)',
      },
      {
        displayName: 'Sticker URL',
        name: 'stickerUrl',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['sendSticker'], stickerSource: ['url'] },
        },
        description: 'URL of the sticker to send (WhatsApp expects a WebP image)',
      },
      {
        displayName: 'Base64 Data',
        name: 'stickerBase64',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['sendSticker'], stickerSource: ['base64'] },
        },
        description: 'Base64 encoded sticker data',
      },
      {
        displayName: 'MIME Type',
        name: 'stickerMimeType',
        type: 'string',
        default: 'image/webp',
        required: true,
        placeholder: 'image/webp',
        displayOptions: {
          show: { resource: ['message'], operation: ['sendSticker'], stickerSource: ['base64'] },
        },
        description:
          'MIME type of the base64 sticker. WhatsApp requires image/webp. OpenWA requires this whenever base64 data is sent.',
      },
      // Send Contact fields
      {
        displayName: 'Contact Name',
        name: 'contactName',
        type: 'string',
        default: '',
        required: true,
        displayOptions: { show: { resource: ['message'], operation: ['sendContact'] } },
        description: 'Display name for the shared contact card',
      },
      {
        displayName: 'Contact Number',
        name: 'contactNumber',
        type: 'string',
        default: '',
        required: true,
        placeholder: '+628123456789',
        displayOptions: { show: { resource: ['message'], operation: ['sendContact'] } },
        description:
          'Phone number for the shared contact, including country code (it is not auto-prefixed)',
      },
      // Mentions (Send Text / Image / Video / Document)
      {
        displayName: 'Mentions',
        name: 'mentions',
        type: 'string',
        typeOptions: {
          multipleValues: true,
          multipleValueButtonText: 'Add Mention',
        },
        default: [],
        placeholder: '628123456789@c.us',
        displayOptions: {
          show: {
            resource: ['message'],
            operation: ['sendText', 'sendImage', 'sendDocument', 'sendVideo'],
          },
        },
        description:
          'WhatsApp IDs to @mention (e.g. 628123456789@c.us). The message text or caption must also contain a matching @-mention token (e.g. @628123456789) for it to render.',
      },
      // Reply / React / Delete target message
      {
        displayName: 'Quoted Message ID',
        name: 'quotedMessageId',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'true_628123456789@c.us_3EB0...',
        displayOptions: {
          show: { resource: ['message'], operation: ['reply'] },
        },
        description:
          'The full serialized ID of the message to quote, as returned by send operations or delivered by the Trigger',
      },
      {
        displayName: 'Message ID',
        name: 'messageId',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'true_628123456789@c.us_3EB0...',
        displayOptions: {
          show: { resource: ['message'], operation: ['react', 'delete'] },
        },
        description:
          'The full serialized ID of the target message, as returned by send operations or delivered by the Trigger',
      },
      {
        displayName: 'Emoji',
        name: 'emoji',
        type: 'string',
        default: '',
        placeholder: '👍',
        displayOptions: {
          show: { resource: ['message'], operation: ['react'] },
        },
        description: 'The emoji to react with. Leave empty to remove your existing reaction.',
      },
      {
        displayName: 'Delete for Everyone',
        name: 'forEveryone',
        type: 'boolean',
        default: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['delete'] },
        },
        description:
          'Whether to revoke the message for everyone. Turn off to remove only your own local copy.',
      },
      // Send Bulk fields
      {
        displayName: 'Messages (JSON)',
        name: 'bulkMessages',
        type: 'json',
        default: '[]',
        required: true,
        displayOptions: { show: { resource: ['message'], operation: ['sendBulk'] } },
        description:
          'Array of up to 100 items. Text item: { "chatId": "628...@c.us", "type": "text", "content": { "text": "hi" } }. Media item: same shape with "type" set to image/video/audio/document and the media nested under that key in "content" — provide it as a remote link or a "base64" field (base64 also needs "mimetype"), plus an optional "caption". No binary source in bulk.',
      },
      {
        displayName: 'Batch ID',
        name: 'batchId',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['message'], operation: ['sendBulk'] } },
        description:
          'Optional custom batch ID (must be unique per session). Leave empty to let the server generate one.',
      },
      {
        displayName: 'Options',
        name: 'bulkOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: { show: { resource: ['message'], operation: ['sendBulk'] } },
        description:
          'If left empty, the server applies its own defaults (delay 3000 ms, randomize on, stop-on-error off)',
        options: [
          {
            displayName: 'Delay Between Messages (Ms)',
            name: 'delayBetweenMessages',
            type: 'number',
            typeOptions: { minValue: 1000, maxValue: 60000 },
            default: 3000,
            description: 'Milliseconds to wait between sends (1000–60000)',
          },
          {
            displayName: 'Randomize Delay',
            name: 'randomizeDelay',
            type: 'boolean',
            default: true,
            description: 'Whether to add a random 0–2000 ms on top of the delay',
          },
          {
            displayName: 'Stop on Error',
            name: 'stopOnError',
            type: 'boolean',
            default: false,
            description: 'Whether to abort the batch on the first failed send',
          },
        ],
      },
      {
        displayName: 'Batch ID',
        name: 'statusBatchId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { resource: ['message'], operation: ['getBatchStatus', 'cancelBatch'] },
        },
        description: 'The batch ID returned by Send Bulk',
      },

      // ============== CONTACT OPERATIONS ==============
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: { resource: ['contact'] },
        },
        options: [
          { name: 'Block', value: 'block', action: 'Block a contact' },
          { name: 'Check Exists', value: 'checkExists', action: 'Check if a number exists' },
          { name: 'Get Info', value: 'getInfo', action: 'Get contact information' },
          { name: 'Get Phone', value: 'getPhone', action: 'Resolve a contact phone number' },
          {
            name: 'Get Profile Picture',
            value: 'getProfilePicture',
            action: 'Get a contact profile picture',
          },
          { name: 'Unblock', value: 'unblock', action: 'Unblock a contact' },
        ],
        default: 'checkExists',
      },
      {
        displayName: 'Session ID',
        name: 'sessionId',
        type: 'string',
        default: 'default',
        required: true,
        displayOptions: {
          show: { resource: ['contact'] },
        },
        description: 'The ID of the session',
      },
      {
        displayName: 'Phone Number',
        name: 'phoneNumber',
        type: 'string',
        default: '',
        required: true,
        placeholder: '628123456789',
        displayOptions: {
          show: { resource: ['contact'], operation: ['checkExists'] },
        },
        description: 'Phone number to check (without + or spaces)',
      },
      {
        displayName: 'Contact ID',
        name: 'contactId',
        type: 'string',
        default: '',
        required: true,
        placeholder: '628123456789@c.us',
        displayOptions: {
          show: {
            resource: ['contact'],
            operation: ['getInfo', 'block', 'unblock', 'getProfilePicture', 'getPhone'],
          },
        },
        description: 'The contact ID (WhatsApp JID, e.g. 628123456789@c.us)',
      },

      // ============== WEBHOOK OPERATIONS ==============
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: { resource: ['webhook'] },
        },
        options: [
          { name: 'Create', value: 'create', action: 'Create a webhook' },
          { name: 'Delete', value: 'delete', action: 'Delete a webhook' },
          { name: 'Test', value: 'test', action: 'Send a test delivery to a webhook' },
          { name: 'Update', value: 'update', action: 'Update a webhook' },
        ],
        default: 'create',
      },
      {
        displayName: 'Session ID',
        name: 'sessionId',
        type: 'string',
        default: 'default',
        required: true,
        displayOptions: {
          show: { resource: ['webhook'] },
        },
        description: 'The ID of the session',
      },
      {
        displayName: 'Webhook URL',
        name: 'webhookUrl',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { resource: ['webhook'], operation: ['create'] },
        },
        description: 'The URL to receive webhook events',
      },
      {
        displayName: 'Events',
        name: 'events',
        type: 'multiOptions',
        options: [
          { name: 'Group Join (Reserved — Not Yet Delivered)', value: 'group.join' },
          { name: 'Group Leave (Reserved — Not Yet Delivered)', value: 'group.leave' },
          { name: 'Group Update (Reserved — Not Yet Delivered)', value: 'group.update' },
          { name: 'Message Ack', value: 'message.ack' },
          { name: 'Message Failed', value: 'message.failed' },
          { name: 'Message Reaction', value: 'message.reaction' },
          { name: 'Message Received', value: 'message.received' },
          { name: 'Message Revoked', value: 'message.revoked' },
          { name: 'Message Sent', value: 'message.sent' },
          { name: 'Session Authenticated', value: 'session.authenticated' },
          { name: 'Session Disconnected', value: 'session.disconnected' },
          { name: 'Session QR', value: 'session.qr' },
          { name: 'Session Status', value: 'session.status' },
        ],
        default: ['message.received'],
        displayOptions: {
          show: { resource: ['webhook'], operation: ['create'] },
        },
        description: 'Events to subscribe to',
      },
      {
        displayName: 'Webhook Secret',
        name: 'webhookSecret',
        type: 'string',
        typeOptions: {
          password: true,
        },
        default: '',
        displayOptions: {
          show: { resource: ['webhook'], operation: ['create'] },
        },
        description:
          'Optional shared secret. If set, OpenWA signs each delivery to this webhook with an X-OpenWA-Signature (HMAC-SHA256) header.',
      },
      {
        displayName: 'Webhook ID',
        name: 'webhookId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { resource: ['webhook'], operation: ['delete', 'update', 'test'] },
        },
        description: 'The ID of the webhook',
      },
      {
        displayName: 'Update Fields',
        name: 'updateFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: {
          show: { resource: ['webhook'], operation: ['update'] },
        },
        description: 'Only the fields you set are changed; everything else keeps its current value',
        options: [
          {
            displayName: 'Active',
            name: 'active',
            type: 'boolean',
            default: true,
            description: 'Whether the webhook is enabled',
          },
          {
            displayName: 'Events',
            name: 'events',
            type: 'multiOptions',
            options: [
              { name: 'Group Join (Reserved — Not Yet Delivered)', value: 'group.join' },
              { name: 'Group Leave (Reserved — Not Yet Delivered)', value: 'group.leave' },
              { name: 'Group Update (Reserved — Not Yet Delivered)', value: 'group.update' },
              { name: 'Message Ack', value: 'message.ack' },
              { name: 'Message Failed', value: 'message.failed' },
              { name: 'Message Reaction', value: 'message.reaction' },
              { name: 'Message Received', value: 'message.received' },
              { name: 'Message Revoked', value: 'message.revoked' },
              { name: 'Message Sent', value: 'message.sent' },
              { name: 'Session Authenticated', value: 'session.authenticated' },
              { name: 'Session Disconnected', value: 'session.disconnected' },
              { name: 'Session QR', value: 'session.qr' },
              { name: 'Session Status', value: 'session.status' },
            ],
            default: [],
            description: 'Replaces the full set of subscribed events (not merged)',
          },
          {
            displayName: 'Filters (JSON)',
            name: 'filters',
            type: 'json',
            default: '',
            description:
              'Advanced delivery filters as a JSON object, e.g. {"conditions":[...]}. Enter null to clear existing filters.',
          },
          {
            displayName: 'Headers (JSON)',
            name: 'headers',
            type: 'json',
            default: '',
            description:
              'Custom delivery headers as a flat JSON object of string values, e.g. {"X-Team":"ops"}',
          },
          {
            displayName: 'Retry Count',
            name: 'retryCount',
            type: 'number',
            typeOptions: { minValue: 0, maxValue: 5 },
            default: 3,
            description: 'Maximum delivery attempts (0–5)',
          },
          {
            displayName: 'Secret',
            name: 'secret',
            type: 'string',
            typeOptions: { password: true },
            default: '',
            description:
              'HMAC-SHA256 signing secret. Set a value to rotate it; an empty value is ignored. To disable signing, recreate the webhook without a secret.',
          },
          {
            displayName: 'URL',
            name: 'url',
            type: 'string',
            default: '',
            description: 'The delivery URL',
          },
        ],
      },
    ],
    usableAsTool: true,
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const resource = this.getNodeParameter('resource', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;

    const credentials = await this.getCredentials('openWaApi');
    const baseUrl = (credentials.serverUrl as string).replace(/\/$/, '');

    for (let i = 0; i < items.length; i++) {
      try {
        let spec: RequestSpec | null = null;
        if (resource === 'session') {
          spec = await buildSessionRequest.call(this, operation, i);
        } else if (resource === 'message') {
          spec = await buildMessageRequest.call(this, operation, i);
        } else if (resource === 'contact') {
          spec = await buildContactRequest.call(this, operation, i);
        } else if (resource === 'webhook') {
          spec = await buildWebhookRequest.call(this, operation, i);
        }

        if (!spec) {
          throw new NodeOperationError(
            this.getNode(),
            `Unsupported resource/operation: ${resource}/${operation}`,
            { itemIndex: i },
          );
        }

        // Make request
        const options: IHttpRequestOptions = {
          method: spec.method,
          url: `${baseUrl}${spec.endpoint}`,
          headers: {
            'Content-Type': 'application/json',
          },
          json: true,
        };

        if (spec.method !== 'GET' && Object.keys(spec.body).length > 0) {
          options.body = spec.body;
        }

        const response = await this.helpers.httpRequestWithAuthentication.call(
          this,
          'openWaApi',
          options,
        );

        // A successful DELETE returns 204 No Content (empty body); surface a concrete
        // result so downstream nodes get an object to read instead of an empty item.
        const json =
          spec.method === 'DELETE' &&
          (response === '' || response === undefined || response === null)
            ? { success: true }
            : (response as JsonObject);
        returnData.push({ json, pairedItem: { item: i } });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
          continue;
        }
        if (error instanceof NodeOperationError) {
          throw new NodeOperationError(this.getNode(), error);
        }
        throw new NodeApiError(this.getNode(), error as JsonObject);
      }
    }

    return [returnData];
  }
}
