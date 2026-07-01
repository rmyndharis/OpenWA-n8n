import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IHttpRequestMethods,
  IHttpRequestOptions,
  JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

function sanitizePathParam(value: string, paramName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${paramName} cannot be empty`);
  }
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error(`${paramName} contains invalid characters`);
  }
  return encodeURIComponent(trimmed);
}

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
    inputs: ['main'],
    outputs: ['main'],
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
          { name: 'Get Status', value: 'getStatus', action: 'Get session status' },
          { name: 'List All', value: 'listAll', action: 'List all sessions' },
        ],
        default: 'getStatus',
      },
      {
        displayName: 'Session ID',
        name: 'sessionId',
        type: 'string',
        default: 'default',
        required: true,
        displayOptions: {
          show: { resource: ['session'], operation: ['getStatus'] },
        },
        description: 'The ID of the session',
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
          { name: 'Send Document', value: 'sendDocument', action: 'Send a document' },
          { name: 'Send Image', value: 'sendImage', action: 'Send an image' },
          { name: 'Send Location', value: 'sendLocation', action: 'Send a location' },
          { name: 'Send Text', value: 'sendText', action: 'Send a text message' },
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
          show: { resource: ['message'] },
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
          show: { resource: ['message'], operation: ['sendText'] },
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
          show: { resource: ['message'], operation: ['sendImage', 'sendDocument'] },
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
      // Mentions (Send Text / Image / Document)
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
          show: { resource: ['message'], operation: ['sendText', 'sendImage', 'sendDocument'] },
        },
        description:
          'WhatsApp IDs to @mention (e.g. 628123456789@c.us). The message text or caption must also contain a matching @-mention token (e.g. @628123456789) for it to render.',
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
          { name: 'Check Exists', value: 'checkExists', action: 'Check if number exists on WhatsApp' },
          { name: 'Get Info', value: 'getInfo', action: 'Get contact information' },
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
          show: { resource: ['contact'], operation: ['getInfo'] },
        },
        description: 'The contact ID to get info for',
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
          { name: 'Message Received', value: 'message.received' },
          { name: 'Message Sent', value: 'message.sent' },
          { name: 'Message Ack', value: 'message.ack' },
          { name: 'Message Failed', value: 'message.failed' },
          { name: 'Message Revoked', value: 'message.revoked' },
          { name: 'Message Reaction', value: 'message.reaction' },
          { name: 'Session Status', value: 'session.status' },
          { name: 'Session QR', value: 'session.qr' },
          { name: 'Session Authenticated', value: 'session.authenticated' },
          { name: 'Session Disconnected', value: 'session.disconnected' },
          { name: 'Group Join (Reserved — Not Yet Delivered)', value: 'group.join' },
          { name: 'Group Leave (Reserved — Not Yet Delivered)', value: 'group.leave' },
          { name: 'Group Update (Reserved — Not Yet Delivered)', value: 'group.update' },
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
          show: { resource: ['webhook'], operation: ['delete'] },
        },
        description: 'The ID of the webhook to delete',
      },
    ],
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
        let endpoint = '';
        let method: IHttpRequestMethods = 'GET';
        let body: Record<string, unknown> = {};

        // SESSION
        if (resource === 'session') {
          if (operation === 'getStatus') {
            const sessionId = sanitizePathParam(
              this.getNodeParameter('sessionId', i) as string,
              'Session ID',
            );
            endpoint = `/api/sessions/${sessionId}`;
            method = 'GET';
          } else if (operation === 'listAll') {
            endpoint = '/api/sessions';
            method = 'GET';
          }
        }

        // MESSAGE
        else if (resource === 'message') {
          const sessionId = sanitizePathParam(
            this.getNodeParameter('sessionId', i) as string,
            'Session ID',
          );
          const chatId = (this.getNodeParameter('chatId', i) as string).trim();
          if (!chatId) {
            throw new NodeOperationError(this.getNode(), 'Chat ID cannot be empty', {
              itemIndex: i,
            });
          }

          if (operation === 'sendText') {
            endpoint = `/api/sessions/${sessionId}/messages/send-text`;
            method = 'POST';
            body = {
              chatId,
              text: this.getNodeParameter('message', i) as string,
            };
          } else if (operation === 'sendImage') {
            endpoint = `/api/sessions/${sessionId}/messages/send-image`;
            method = 'POST';
            const imageSource = this.getNodeParameter('imageSource', i) as string;
            body = { chatId };
            const caption = (this.getNodeParameter('caption', i, '') as string).trim();
            if (caption) {
              body.caption = caption;
            }
            if (imageSource === 'binary') {
              const binaryPropertyName = this.getNodeParameter('imageBinaryProperty', i) as string;
              const binary = this.helpers.assertBinaryData(i, binaryPropertyName);
              const binaryData = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
              body.base64 = binaryData.toString('base64');
              // OpenWA rejects base64 without a mimetype; fall back to the server's own
              // default if the binary item somehow carries no MIME type.
              body.mimetype = binary.mimeType || 'application/octet-stream';
            } else if (imageSource === 'url') {
              body.url = this.getNodeParameter('imageUrl', i) as string;
            } else {
              body.base64 = this.getNodeParameter('imageBase64', i) as string;
              body.mimetype = this.getNodeParameter('imageMimeType', i) as string;
            }
          } else if (operation === 'sendDocument') {
            endpoint = `/api/sessions/${sessionId}/messages/send-document`;
            method = 'POST';
            const documentSource = this.getNodeParameter('documentSource', i) as string;
            body = {
              chatId,
              filename: this.getNodeParameter('filename', i, 'document.pdf') as string,
            };
            const caption = (this.getNodeParameter('caption', i, '') as string).trim();
            if (caption) {
              body.caption = caption;
            }
            if (documentSource === 'binary') {
              const binaryPropertyName = this.getNodeParameter(
                'documentBinaryProperty',
                i,
              ) as string;
              const binary = this.helpers.assertBinaryData(i, binaryPropertyName);
              const binaryData = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
              body.base64 = binaryData.toString('base64');
              // OpenWA rejects base64 without a mimetype; fall back to the server's own
              // default if the binary item somehow carries no MIME type.
              body.mimetype = binary.mimeType || 'application/octet-stream';
            } else if (documentSource === 'url') {
              body.url = this.getNodeParameter('documentUrl', i) as string;
            } else {
              body.base64 = this.getNodeParameter('documentBase64', i) as string;
              body.mimetype = this.getNodeParameter('documentMimeType', i) as string;
            }
          } else if (operation === 'sendLocation') {
            endpoint = `/api/sessions/${sessionId}/messages/send-location`;
            method = 'POST';
            body = {
              chatId,
              latitude: this.getNodeParameter('latitude', i) as number,
              longitude: this.getNodeParameter('longitude', i) as number,
            };
            const locationName = (
              this.getNodeParameter('locationName', i, '') as string
            ).trim();
            if (locationName) {
              // OpenWA's SendLocationDto uses `description` for the location label.
              body.description = locationName;
            }
          }

          // Optional @mentions — only send-text/image/document accept them. Guard by
          // operation (not just the hidden field) so a mentions value can never ride
          // along on a sendLocation request, whose DTO rejects unknown fields (400).
          if (operation === 'sendText' || operation === 'sendImage' || operation === 'sendDocument') {
            const rawMentions = this.getNodeParameter('mentions', i, []);
            const mentions = (Array.isArray(rawMentions) ? rawMentions : [])
              .map((m) => String(m).trim())
              .filter(Boolean);
            if (mentions.length > 0) {
              body.mentions = mentions;
            }
          }
        }

        // CONTACT
        else if (resource === 'contact') {
          const sessionId = sanitizePathParam(
            this.getNodeParameter('sessionId', i) as string,
            'Session ID',
          );

          if (operation === 'checkExists') {
            const phoneNumber = (this.getNodeParameter('phoneNumber', i) as string)
              .trim()
              .replace(/[\s+\-()]/g, '');
            if (!phoneNumber || !/^\d+$/.test(phoneNumber)) {
              throw new NodeOperationError(
                this.getNode(),
                'Phone number must contain only digits (no +, spaces, or special characters)',
                { itemIndex: i },
              );
            }
            endpoint = `/api/sessions/${sessionId}/contacts/check/${encodeURIComponent(phoneNumber)}`;
            method = 'GET';
          } else if (operation === 'getInfo') {
            const contactId = (this.getNodeParameter('contactId', i) as string).trim();
            if (!contactId) {
              throw new NodeOperationError(this.getNode(), 'Contact ID cannot be empty', {
                itemIndex: i,
              });
            }
            endpoint = `/api/sessions/${sessionId}/contacts/${encodeURIComponent(contactId)}`;
            method = 'GET';
          }
        }

        // WEBHOOK
        else if (resource === 'webhook') {
          const sessionId = sanitizePathParam(
            this.getNodeParameter('sessionId', i) as string,
            'Session ID',
          );

          if (operation === 'create') {
            endpoint = `/api/sessions/${sessionId}/webhooks`;
            method = 'POST';
            const events = this.getNodeParameter('events', i) as string[];
            if (!events || events.length === 0) {
              throw new NodeOperationError(
                this.getNode(),
                'At least one event must be selected',
                { itemIndex: i },
              );
            }
            body = {
              url: this.getNodeParameter('webhookUrl', i) as string,
              events,
            };
            const webhookSecret = this.getNodeParameter('webhookSecret', i, '') as string;
            if (webhookSecret) {
              body.secret = webhookSecret;
            }
          } else if (operation === 'delete') {
            const webhookId = sanitizePathParam(
              this.getNodeParameter('webhookId', i) as string,
              'Webhook ID',
            );
            endpoint = `/api/sessions/${sessionId}/webhooks/${webhookId}`;
            method = 'DELETE';
          }
        }

        // Unhandled resource/operation
        if (!endpoint) {
          throw new NodeOperationError(
            this.getNode(),
            `Unsupported resource/operation: ${resource}/${operation}`,
            { itemIndex: i },
          );
        }

        // Make request
        const options: IHttpRequestOptions = {
          method,
          url: `${baseUrl}${endpoint}`,
          headers: {
            'Content-Type': 'application/json',
          },
          json: true,
        };

        if (method !== 'GET' && Object.keys(body).length > 0) {
          options.body = body;
        }

        const response = await this.helpers.httpRequestWithAuthentication.call(
          this,
          'openWaApi',
          options,
        );

        // A successful DELETE returns 204 No Content (empty body); surface a concrete
        // result so downstream nodes get an object to read instead of an empty item.
        const json =
          method === 'DELETE' && (response === '' || response === undefined || response === null)
            ? { success: true }
            : (response as JsonObject);
        returnData.push({ json, pairedItem: { item: i } });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
          continue;
        }
        if (error instanceof NodeOperationError) {
          throw error;
        }
        throw new NodeApiError(this.getNode(), error as JsonObject);
      }
    }

    return [returnData];
  }
}
