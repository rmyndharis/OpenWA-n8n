import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IHttpRequestMethods,
  IHttpRequestOptions,
  JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

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
          { name: 'URL', value: 'url' },
          { name: 'Base64', value: 'base64' },
        ],
        default: 'url',
        displayOptions: {
          show: { resource: ['message'], operation: ['sendImage'] },
        },
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
          { name: 'URL', value: 'url' },
          { name: 'Base64', value: 'base64' },
        ],
        default: 'url',
        displayOptions: {
          show: { resource: ['message'], operation: ['sendDocument'] },
        },
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
          { name: 'Session Connected', value: 'session.connected' },
          { name: 'Session Disconnected', value: 'session.disconnected' },
          { name: 'Session QR Ready', value: 'session.qr_ready' },
        ],
        default: ['message.received'],
        displayOptions: {
          show: { resource: ['webhook'], operation: ['create'] },
        },
        description: 'Events to subscribe to',
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
            const sessionId = this.getNodeParameter('sessionId', i) as string;
            endpoint = `/api/sessions/${sessionId}`;
            method = 'GET';
          } else if (operation === 'listAll') {
            endpoint = '/api/sessions';
            method = 'GET';
          }
        }

        // MESSAGE
        if (resource === 'message') {
          const sessionId = this.getNodeParameter('sessionId', i) as string;
          const chatId = this.getNodeParameter('chatId', i) as string;

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
            body = {
              chatId,
              caption: this.getNodeParameter('caption', i, '') as string,
            };
            if (imageSource === 'url') {
              body.url = this.getNodeParameter('imageUrl', i) as string;
            } else {
              body.base64 = this.getNodeParameter('imageBase64', i) as string;
            }
          } else if (operation === 'sendDocument') {
            endpoint = `/api/sessions/${sessionId}/messages/send-document`;
            method = 'POST';
            const documentSource = this.getNodeParameter('documentSource', i) as string;
            body = {
              chatId,
              caption: this.getNodeParameter('caption', i, '') as string,
              filename: this.getNodeParameter('filename', i, 'document.pdf') as string,
            };
            if (documentSource === 'url') {
              body.url = this.getNodeParameter('documentUrl', i) as string;
            } else {
              body.base64 = this.getNodeParameter('documentBase64', i) as string;
            }
          } else if (operation === 'sendLocation') {
            endpoint = `/api/sessions/${sessionId}/messages/send-location`;
            method = 'POST';
            body = {
              chatId,
              latitude: this.getNodeParameter('latitude', i) as number,
              longitude: this.getNodeParameter('longitude', i) as number,
              name: this.getNodeParameter('locationName', i, '') as string,
            };
          }
        }

        // CONTACT
        if (resource === 'contact') {
          const sessionId = this.getNodeParameter('sessionId', i) as string;

          if (operation === 'checkExists') {
            const phoneNumber = this.getNodeParameter('phoneNumber', i) as string;
            endpoint = `/api/sessions/${sessionId}/contacts/check/${phoneNumber}`;
            method = 'GET';
          } else if (operation === 'getInfo') {
            const contactId = this.getNodeParameter('contactId', i) as string;
            endpoint = `/api/sessions/${sessionId}/contacts/${contactId}`;
            method = 'GET';
          }
        }

        // WEBHOOK
        if (resource === 'webhook') {
          const sessionId = this.getNodeParameter('sessionId', i) as string;

          if (operation === 'create') {
            endpoint = `/api/sessions/${sessionId}/webhooks`;
            method = 'POST';
            body = {
              url: this.getNodeParameter('webhookUrl', i) as string,
              events: this.getNodeParameter('events', i) as string[],
            };
          } else if (operation === 'delete') {
            const webhookId = this.getNodeParameter('webhookId', i) as string;
            endpoint = `/api/sessions/${sessionId}/webhooks/${webhookId}`;
            method = 'DELETE';
          }
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

        returnData.push({ json: response as JsonObject });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: (error as Error).message } });
          continue;
        }
        throw new NodeApiError(this.getNode(), error as JsonObject);
      }
    }

    return [returnData];
  }
}
