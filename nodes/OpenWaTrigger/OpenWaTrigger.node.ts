import type {
  IHookFunctions,
  IWebhookFunctions,
  INodeType,
  INodeTypeDescription,
  IWebhookResponseData,
  JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import { verifyOpenWaSignature } from './verifySignature';
import { httpStatusFromError } from './httpStatus';
import { webhookConfigHash } from './configHash';
import { sanitizePathParam } from '../shared/sanitizePathParam';

export class OpenWaTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'OpenWA Trigger',
    name: 'openWaTrigger',
    icon: 'file:openwa.svg',
    group: ['trigger'],
    version: 1,
    subtitle: '={{$parameter["events"].join(", ")}}',
    description: 'Starts workflow when OpenWA events occur',
    defaults: {
      name: 'OpenWA Trigger',
    },
    inputs: [],
    outputs: ['main'],
    credentials: [
      {
        name: 'openWaApi',
        required: true,
      },
    ],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'webhook',
      },
    ],
    properties: [
      {
        displayName: 'Session ID',
        name: 'sessionId',
        type: 'string',
        default: 'default',
        required: true,
        description: 'The ID of the session to receive events from',
      },
      {
        displayName: 'Events',
        name: 'events',
        type: 'multiOptions',
        options: [
          {
            name: 'Message Received',
            value: 'message.received',
            description: 'Triggers when a new message is received',
          },
          {
            name: 'Message Sent',
            value: 'message.sent',
            description: 'Triggers when a message is sent successfully',
          },
          {
            name: 'Message Ack',
            value: 'message.ack',
            description: 'Triggers on a message delivery or read acknowledgement',
          },
          {
            name: 'Message Failed',
            value: 'message.failed',
            description: 'Triggers when a message fails to send',
          },
          {
            name: 'Message Revoked',
            value: 'message.revoked',
            description: 'Triggers when a message is deleted for everyone',
          },
          {
            name: 'Message Reaction',
            value: 'message.reaction',
            description: 'Triggers when a reaction is added to or removed from a message',
          },
          {
            name: 'Session Status',
            value: 'session.status',
            description: 'Triggers on any session status change',
          },
          {
            name: 'Session QR',
            value: 'session.qr',
            description: 'Triggers when a new QR code is generated',
          },
          {
            name: 'Session Authenticated',
            value: 'session.authenticated',
            description: 'Triggers when the session is authenticated',
          },
          {
            name: 'Session Disconnected',
            value: 'session.disconnected',
            description: 'Triggers when the session loses connection',
          },
          {
            name: 'Group Join (Reserved — Not Yet Delivered)',
            value: 'group.join',
            description:
              'Reserved by OpenWA: accepted on subscribe but not dispatched yet, so it never fires',
          },
          {
            name: 'Group Leave (Reserved — Not Yet Delivered)',
            value: 'group.leave',
            description:
              'Reserved by OpenWA: accepted on subscribe but not dispatched yet, so it never fires',
          },
          {
            name: 'Group Update (Reserved — Not Yet Delivered)',
            value: 'group.update',
            description:
              'Reserved by OpenWA: accepted on subscribe but not dispatched yet, so it never fires',
          },
        ],
        default: ['message.received'],
        required: true,
        description: 'The events to listen to',
      },
      {
        displayName: 'Webhook Secret',
        name: 'webhookSecret',
        type: 'string',
        typeOptions: {
          password: true,
        },
        default: '',
        description:
          'Optional shared secret. If set, it is registered with OpenWA at webhook creation and every delivery is verified against its X-OpenWA-Signature (HMAC-SHA256) header; deliveries that fail verification are dropped. Changing or clearing the secret (or changing the events or session) re-registers the webhook automatically on the next activation.',
      },
      {
        displayName:
          'Each event arrives as an envelope: <code>event</code>, <code>timestamp</code>, <code>sessionId</code>, <code>idempotencyKey</code>, <code>deliveryId</code>, and the event payload under <code>data</code>. Read message fields from <code>data</code> (e.g. <code>{{ $json.data }}</code>), and use <code>deliveryId</code> to de-duplicate retried deliveries. Some payloads carry extra fields under <code>data</code>, e.g. <code>type: "masked"</code> for a withheld business message and <code>revokedId</code> on a <code>message.revoked</code> event.',
        name: 'outputShapeNotice',
        type: 'notice',
        default: '',
      },
    ],
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData('node');
        if (webhookData.webhookId === undefined) {
          return false;
        }

        const credentials = await this.getCredentials('openWaApi');
        const baseUrl = (credentials.serverUrl as string).replace(/\/$/, '');
        const sessionId = sanitizePathParam(
          this.getNodeParameter('sessionId') as string,
          'Session ID',
        );

        // If the configuration the registration depends on has changed since the
        // webhook was created (secret, events, session, or this instance's webhook
        // URL), the stored registration is stale: remove it and report absent so
        // n8n re-creates it with the current configuration. A missing configHash
        // means the registration predates this tracking — probe it as before.
        const storedHash = webhookData.configHash as string | undefined;
        if (storedHash !== undefined) {
          const currentHash = webhookConfigHash({
            url: this.getNodeWebhookUrl('default') ?? '',
            events: this.getNodeParameter('events') as string[],
            secret: this.getNodeParameter('webhookSecret', '') as string,
            sessionId,
          });
          if (storedHash !== currentHash) {
            // Delete from the STORED session — the current parameter may already
            // point at a different session than the one the webhook lives on.
            const staleSessionId = sanitizePathParam(
              (webhookData.sessionId as string) ?? sessionId,
              'Session ID',
            );
            try {
              await this.helpers.httpRequestWithAuthentication.call(this, 'openWaApi', {
                method: 'DELETE',
                url: `${baseUrl}/api/sessions/${staleSessionId}/webhooks/${encodeURIComponent(webhookData.webhookId as string)}`,
                json: true,
              });
            } catch (error) {
              // Already gone remotely is fine. Anything else must fail loud and let
              // n8n's activation retry complete the cleanup — silently proceeding
              // would orphan the old registration, which would keep delivering.
              if (httpStatusFromError(error) !== 404) {
                throw error;
              }
            }
            delete webhookData.webhookId;
            delete webhookData.sessionId;
            delete webhookData.configHash;
            return false;
          }
        }

        try {
          await this.helpers.httpRequestWithAuthentication.call(this, 'openWaApi', {
            method: 'GET',
            url: `${baseUrl}/api/sessions/${sessionId}/webhooks/${encodeURIComponent(webhookData.webhookId as string)}`,
            json: true,
          });
          return true;
        } catch (error) {
          // A 404 means the webhook is genuinely gone → report absent so n8n
          // recreates it. Any other error is inconclusive: rethrow so activation
          // fails loudly and n8n's retry restores it, instead of registering a
          // duplicate webhook (the server does not de-duplicate by URL).
          if (httpStatusFromError(error) === 404) {
            return false;
          }
          throw error;
        }
      },

      async create(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl('default');
        const credentials = await this.getCredentials('openWaApi');
        const baseUrl = (credentials.serverUrl as string).replace(/\/$/, '');
        const sessionId = sanitizePathParam(
          this.getNodeParameter('sessionId') as string,
          'Session ID',
        );
        const events = this.getNodeParameter('events') as string[];
        const webhookSecret = this.getNodeParameter('webhookSecret', '') as string;

        if (!events || events.length === 0) {
          throw new Error('At least one event must be selected');
        }

        const body: Record<string, unknown> = {
          url: webhookUrl,
          events,
        };
        // Register the shared secret so OpenWA signs each delivery (HMAC-SHA256).
        if (webhookSecret) {
          body.secret = webhookSecret;
        }

        const response = await this.helpers.httpRequestWithAuthentication.call(
          this,
          'openWaApi',
          {
            method: 'POST',
            url: `${baseUrl}/api/sessions/${sessionId}/webhooks`,
            body,
            json: true,
          },
        );

        const webhookId = (response as Record<string, unknown>).id;
        if (!webhookId) {
          throw new NodeApiError(
            this.getNode(),
            { message: 'Webhook created but no ID returned in response' } as unknown as JsonObject,
          );
        }

        const webhookData = this.getWorkflowStaticData('node');
        // Normalize to string so checkExists/delete comparisons stay consistent.
        webhookData.webhookId = String(webhookId);
        // Remember the configuration this registration was made with, so a later
        // checkExists can detect a stale registration and re-register instead of
        // silently running with an old secret/events/URL. Only the hash is stored.
        webhookData.sessionId = sessionId;
        webhookData.configHash = webhookConfigHash({
          url: webhookUrl ?? '',
          events,
          secret: webhookSecret,
          sessionId,
        });
        return true;
      },

      async delete(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData('node');

        if (webhookData.webhookId === undefined) {
          return true;
        }

        const credentials = await this.getCredentials('openWaApi');
        const baseUrl = (credentials.serverUrl as string).replace(/\/$/, '');
        const sessionId = sanitizePathParam(
          this.getNodeParameter('sessionId') as string,
          'Session ID',
        );

        try {
          await this.helpers.httpRequestWithAuthentication.call(this, 'openWaApi', {
            method: 'DELETE',
            url: `${baseUrl}/api/sessions/${sessionId}/webhooks/${encodeURIComponent(webhookData.webhookId as string)}`,
            json: true,
          });
        } catch (error) {
          // An already-deleted webhook (404) is fine to swallow; anything else propagates.
          if (httpStatusFromError(error) !== 404) {
            throw error;
          }
        }

        delete webhookData.webhookId;
        delete webhookData.sessionId;
        delete webhookData.configHash;
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const req = this.getRequestObject();

    // Verify the HMAC-SHA256 signature when a secret is configured. OpenWA signs
    // the raw request body and sends it as `X-OpenWA-Signature: sha256=<hex>`.
    const webhookSecret = this.getNodeParameter('webhookSecret', '') as string;
    if (webhookSecret) {
      if (typeof req.readRawBody === 'function' && !req.rawBody) {
        await req.readRawBody();
      }
      // The raw bytes are the reliable source — OpenWA signs the exact JSON it
      // sends. Re-serializing the parsed body is only a last-resort fallback.
      const rawBody: Buffer | string = req.rawBody ?? JSON.stringify(req.body ?? {});
      const signatureHeader = req.headers['x-openwa-signature'];
      const signature = typeof signatureHeader === 'string' ? signatureHeader : undefined;
      if (!verifyOpenWaSignature(rawBody, webhookSecret, signature)) {
        // Reject with 401 so OpenWA sees the delivery was refused. IWebhookResponseData
        // has no status field, so set it on the response and suppress n8n's own response.
        this.getResponseObject().status(401).send('Unauthorized');
        return {
          noWebhookResponse: true,
          workflowData: [[]],
        };
      }
    }

    const body = req.body;
    // Validate payload is an object
    if (!body || typeof body !== 'object') {
      return {
        workflowData: [[]],
      };
    }

    return {
      workflowData: [this.helpers.returnJsonArray(body)],
    };
  }
}
