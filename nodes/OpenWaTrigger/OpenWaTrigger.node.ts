import type {
  IDataObject,
  IHookFunctions,
  IWebhookFunctions,
  ILoadOptionsFunctions,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
  IWebhookResponseData,
  JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { verifyOpenWaSignature } from './verifySignature';
import { httpStatusFromError } from './httpStatus';
import { webhookConfigHash } from './configHash';
import { sanitizePathParam } from '../shared/sanitizePathParam';
import { webhookSecretProblem } from '../shared/webhookSecret';
import { WEBHOOK_EVENT_OPTIONS } from '../shared/webhookEvents';
import { getSessions } from '../OpenWa/loadOptions';

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
    outputs: [NodeConnectionTypes.Main],
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
        // Scoped to the session so several active workflows can each run an OpenWA
        // Trigger without colliding on one shared path. A change here changes the
        // delivery URL; checkExists detects that via the config hash and
        // re-registers the webhook automatically on the next activation.
        path: '={{ "openwa-" + $parameter["sessionId"] }}',
      },
    ],
    properties: [
      {
        displayName: 'Session Name or ID',
        name: 'sessionId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getSessions',
        },
        default: '',
        required: true,
        description:
          'The ID of the session to receive events from. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
      },
      {
        displayName: 'Events',
        name: 'events',
        type: 'multiOptions',
        options: WEBHOOK_EVENT_OPTIONS,
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
          'Optional shared secret, at least 16 characters (the server rejects a shorter one at registration). If set, it is registered with OpenWA at webhook creation and every delivery is verified against its X-OpenWA-Signature (HMAC-SHA256) header; deliveries that fail verification are dropped. Changing or clearing the secret (or changing the events or session) re-registers the webhook automatically on the next activation.',
      },
      {
        displayName: 'Deduplicate Deliveries',
        name: 'deduplicateDeliveries',
        type: 'boolean',
        default: false,
        description:
          'Whether to drop a repeated delivery of the same event, keyed on the envelope\'s idempotencyKey. OpenWA guarantees at-least-once delivery: it retries a failed POST and replays any delivery stranded by a gateway crash, both under the same idempotencyKey, either of which can otherwise run this workflow twice. Best-effort: static data is saved per execution, so two deliveries arriving at the same moment can both pass.',
      },
      {
        displayName:
          'Each event arrives as an envelope: <code>event</code>, <code>timestamp</code>, <code>sessionId</code>, <code>idempotencyKey</code>, <code>deliveryId</code>, and the event payload under <code>data</code>. Read message fields from <code>data</code> (e.g. <code>{{ $json.data }}</code>). To de-duplicate downstream, key on <code>idempotencyKey</code>, which identifies the event and is reused across retries and crash replays; <code>deliveryId</code> identifies a single attempt and changes on every replay. Some payloads carry extra fields under <code>data</code>, e.g. <code>type: "masked"</code> for a withheld business message and <code>revokedId</code> on a <code>message.revoked</code> event.',
        name: 'outputShapeNotice',
        type: 'notice',
        default: '',
      },
    ],
  };

  // Shares the action node's session loader, so both nodes offer the same list
  // from the same credential rather than drifting apart.
  methods = {
    loadOptions: { getSessions } as unknown as Record<
      string,
      (this: ILoadOptionsFunctions) => Promise<INodePropertyOptions[]>
    >,
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

        const webhookUrl = this.getNodeWebhookUrl('default') ?? '';
        const events = this.getNodeParameter('events') as string[];

        // Drop the stored registration from the server and forget it locally, so the
        // caller can report absent and let n8n create a fresh one.
        const discardRegistration = async (): Promise<false> => {
          // Delete from the STORED session: the current parameter may already
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
            // n8n's activation retry complete the cleanup: silently proceeding
            // would orphan the old registration, which would keep delivering.
            if (httpStatusFromError(error) !== 404) {
              throw new NodeApiError(this.getNode(), error as JsonObject);
            }
          }
          delete webhookData.webhookId;
          delete webhookData.sessionId;
          delete webhookData.configHash;
          return false;
        };

        // If the configuration the registration depends on has changed since the
        // webhook was created (secret, events, session, or this instance's webhook
        // URL), the stored registration is stale: remove it and report absent so
        // n8n re-creates it with the current configuration. A missing configHash
        // means the registration predates this tracking, so re-register it once so
        // its configuration becomes known (this also picks up a delivery URL that
        // changed across a package upgrade).
        const currentHash = webhookConfigHash({
          url: webhookUrl,
          events,
          secret: this.getNodeParameter('webhookSecret', '') as string,
          sessionId,
        });
        if ((webhookData.configHash as string | undefined) !== currentHash) {
          return discardRegistration();
        }

        let registration: IDataObject;
        try {
          registration = (await this.helpers.httpRequestWithAuthentication.call(
            this,
            'openWaApi',
            {
              method: 'GET',
              url: `${baseUrl}/api/sessions/${sessionId}/webhooks/${encodeURIComponent(webhookData.webhookId as string)}`,
              json: true,
            },
          )) as IDataObject;
        } catch (error) {
          // A 404 means the webhook is genuinely gone, so report absent and let n8n
          // recreate it. Any other error is inconclusive: rethrow so activation
          // fails loudly and n8n's retry restores it, instead of registering a
          // duplicate webhook (the server does not de-duplicate by URL).
          if (httpStatusFromError(error) === 404) {
            return false;
          }
          throw new NodeApiError(this.getNode(), error as JsonObject);
        }

        // The registration exists, but existing is not the same as delivering. The
        // server dispatches only to webhooks matching `active: true`, and both the
        // URL and the event list can be edited out from under this node (from the
        // dashboard, the API, or the action node's own Webhook Update). Any of those
        // leaves the trigger reporting healthy while nothing ever reaches it, so
        // treat a drifted registration exactly like a stale one and rebuild it.
        // The secret is deliberately not checked: the server never serializes it,
        // and the config hash already covers a local change to it.
        const sameEvents = (a: unknown, b: string[]): boolean => {
          if (!Array.isArray(a) || a.length !== b.length) {
            return false;
          }
          const left = [...(a as string[])].sort();
          const right = [...b].sort();
          return left.every((value, index) => value === right[index]);
        };
        if (
          registration.active === false ||
          (typeof registration.url === 'string' && registration.url !== webhookUrl) ||
          !sameEvents(registration.events, events)
        ) {
          return discardRegistration();
        }

        return true;
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
          throw new NodeOperationError(this.getNode(), 'At least one event must be selected');
        }
        // A short secret is rejected by the server's registration floor; failing
        // here names the field instead of surfacing a raw 400 mid-activation.
        const secretProblem = webhookSecretProblem(webhookSecret);
        if (secretProblem) {
          throw new NodeOperationError(this.getNode(), secretProblem);
        }

        const body: Record<string, unknown> = {
          url: webhookUrl,
          events,
        };
        // Register the shared secret so OpenWA signs each delivery (HMAC-SHA256).
        if (webhookSecret) {
          body.secret = webhookSecret;
        }

        const response = await this.helpers.httpRequestWithAuthentication.call(this, 'openWaApi', {
          method: 'POST',
          url: `${baseUrl}/api/sessions/${sessionId}/webhooks`,
          body,
          json: true,
        });

        const webhookId = (response as Record<string, unknown>).id;
        if (!webhookId) {
          throw new NodeApiError(this.getNode(), {
            message: 'Webhook created but no ID returned in response',
          } as unknown as JsonObject);
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
        // Delete from the session the webhook was registered on — the parameter may
        // have been edited without re-activating since then. Fall back to the
        // parameter for registrations that predate session tracking.
        const sessionId = sanitizePathParam(
          (webhookData.sessionId as string) ?? (this.getNodeParameter('sessionId') as string),
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
            throw new NodeApiError(this.getNode(), error as JsonObject);
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
      // The raw bytes are the only reliable source — OpenWA signs the exact JSON it
      // transmits, and re-serializing a parsed body can reorder keys or change
      // whitespace. Without them the delivery cannot be verified, so reject loudly
      // instead of silently re-serializing (which drops valid deliveries at random).
      if (!req.rawBody) {
        this.logger.warn(
          'OpenWA Trigger cannot verify the delivery signature: the raw request body is unavailable on this n8n version. Upgrade n8n, or clear the Webhook Secret to receive unsigned deliveries.',
        );
        this.getResponseObject().status(401).send('Unauthorized');
        return {
          noWebhookResponse: true,
          workflowData: [[]],
        };
      }
      const signatureHeader = req.headers['x-openwa-signature'];
      const signature = typeof signatureHeader === 'string' ? signatureHeader : undefined;
      if (!verifyOpenWaSignature(req.rawBody, webhookSecret, signature)) {
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

    // Optional de-duplication, keyed on `idempotencyKey`: that value identifies the
    // EVENT and is reused verbatim when the gateway replays a delivery stranded by a
    // crash. `deliveryId` identifies one attempt and is re-minted on every replay, so
    // keying on it catches an in-process retry but misses exactly the redelivery this
    // option exists to absorb. `deliveryId` remains the fallback for older gateways
    // whose envelope carries no idempotency key.
    // Best-effort: static data is saved per execution, so two deliveries arriving at
    // the same moment can both pass.
    if (this.getNodeParameter('deduplicateDeliveries', false) as boolean) {
      const envelope = body as Record<string, unknown>;
      const rawKey =
        typeof envelope.idempotencyKey === 'string' && envelope.idempotencyKey
          ? envelope.idempotencyKey
          : envelope.deliveryId;
      if (typeof rawKey === 'string' && rawKey) {
        const staticData = this.getWorkflowStaticData('node');
        // Key name kept from when the ring held delivery ids, so an upgrade does not
        // strand the previous array in the workflow's stored static data.
        const seen = (staticData.recentDeliveryIds as string[] | undefined) ?? [];
        if (seen.includes(rawKey)) {
          this.logger.debug(`OpenWA Trigger: dropping duplicate delivery ${rawKey}`);
          return {
            workflowData: [[]],
          };
        }
        // Bound the memory: keep only the most recent 500 keys.
        seen.push(rawKey);
        if (seen.length > 500) {
          seen.splice(0, seen.length - 500);
        }
        staticData.recentDeliveryIds = seen;
      }
    }

    return {
      workflowData: [this.helpers.returnJsonArray(body)],
    };
  }
}
