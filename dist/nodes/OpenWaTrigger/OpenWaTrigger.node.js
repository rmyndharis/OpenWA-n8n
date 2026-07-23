"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenWaTrigger = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const verifySignature_1 = require("./verifySignature");
const httpStatus_1 = require("./httpStatus");
const configHash_1 = require("./configHash");
const sanitizePathParam_1 = require("../shared/sanitizePathParam");
class OpenWaTrigger {
    constructor() {
        this.description = {
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
                    // Scoped to the session so several active workflows can each run an OpenWA
                    // Trigger without colliding on one shared path. A change here changes the
                    // delivery URL; checkExists detects that via the config hash and
                    // re-registers the webhook automatically on the next activation.
                    path: '={{ "openwa-" + $parameter["sessionId"] }}',
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
                            description: 'Reserved by OpenWA: accepted on subscribe but not dispatched yet, so it never fires',
                        },
                        {
                            name: 'Group Leave (Reserved — Not Yet Delivered)',
                            value: 'group.leave',
                            description: 'Reserved by OpenWA: accepted on subscribe but not dispatched yet, so it never fires',
                        },
                        {
                            name: 'Group Update (Reserved — Not Yet Delivered)',
                            value: 'group.update',
                            description: 'Reserved by OpenWA: accepted on subscribe but not dispatched yet, so it never fires',
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
                    description: 'Optional shared secret. If set, it is registered with OpenWA at webhook creation and every delivery is verified against its X-OpenWA-Signature (HMAC-SHA256) header; deliveries that fail verification are dropped. Changing or clearing the secret (or changing the events or session) re-registers the webhook automatically on the next activation.',
                },
                {
                    displayName: 'Deduplicate Deliveries',
                    name: 'deduplicateDeliveries',
                    type: 'boolean',
                    default: false,
                    description: 'Whether to drop a repeated delivery of the same event. OpenWA retries failed deliveries with the same deliveryId, which can otherwise run this workflow twice. Best-effort: deliveries arriving at the same moment can both pass, and a retry whose first run FAILED is also dropped — enable only when downstream actions are not idempotent and failed runs are rare.',
                },
                {
                    displayName: 'Each event arrives as an envelope: <code>event</code>, <code>timestamp</code>, <code>sessionId</code>, <code>idempotencyKey</code>, <code>deliveryId</code>, and the event payload under <code>data</code>. Read message fields from <code>data</code> (e.g. <code>{{ $json.data }}</code>), and use <code>deliveryId</code> to de-duplicate retried deliveries. Some payloads carry extra fields under <code>data</code>, e.g. <code>type: "masked"</code> for a withheld business message and <code>revokedId</code> on a <code>message.revoked</code> event.',
                    name: 'outputShapeNotice',
                    type: 'notice',
                    default: '',
                },
            ],
        };
        this.webhookMethods = {
            default: {
                async checkExists() {
                    const webhookData = this.getWorkflowStaticData('node');
                    if (webhookData.webhookId === undefined) {
                        return false;
                    }
                    const credentials = await this.getCredentials('openWaApi');
                    const baseUrl = credentials.serverUrl.replace(/\/$/, '');
                    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId'), 'Session ID');
                    // If the configuration the registration depends on has changed since the
                    // webhook was created (secret, events, session, or this instance's webhook
                    // URL), the stored registration is stale: remove it and report absent so
                    // n8n re-creates it with the current configuration. A missing configHash
                    // means the registration predates this tracking — re-register it once so
                    // its configuration becomes known (this also picks up a delivery URL that
                    // changed across a package upgrade).
                    const currentHash = (0, configHash_1.webhookConfigHash)({
                        url: this.getNodeWebhookUrl('default') ?? '',
                        events: this.getNodeParameter('events'),
                        secret: this.getNodeParameter('webhookSecret', ''),
                        sessionId,
                    });
                    if (webhookData.configHash !== currentHash) {
                        // Delete from the STORED session — the current parameter may already
                        // point at a different session than the one the webhook lives on.
                        const staleSessionId = (0, sanitizePathParam_1.sanitizePathParam)(webhookData.sessionId ?? sessionId, 'Session ID');
                        try {
                            await this.helpers.httpRequestWithAuthentication.call(this, 'openWaApi', {
                                method: 'DELETE',
                                url: `${baseUrl}/api/sessions/${staleSessionId}/webhooks/${encodeURIComponent(webhookData.webhookId)}`,
                                json: true,
                            });
                        }
                        catch (error) {
                            // Already gone remotely is fine. Anything else must fail loud and let
                            // n8n's activation retry complete the cleanup — silently proceeding
                            // would orphan the old registration, which would keep delivering.
                            if ((0, httpStatus_1.httpStatusFromError)(error) !== 404) {
                                throw error;
                            }
                        }
                        delete webhookData.webhookId;
                        delete webhookData.sessionId;
                        delete webhookData.configHash;
                        return false;
                    }
                    try {
                        await this.helpers.httpRequestWithAuthentication.call(this, 'openWaApi', {
                            method: 'GET',
                            url: `${baseUrl}/api/sessions/${sessionId}/webhooks/${encodeURIComponent(webhookData.webhookId)}`,
                            json: true,
                        });
                        return true;
                    }
                    catch (error) {
                        // A 404 means the webhook is genuinely gone → report absent so n8n
                        // recreates it. Any other error is inconclusive: rethrow so activation
                        // fails loudly and n8n's retry restores it, instead of registering a
                        // duplicate webhook (the server does not de-duplicate by URL).
                        if ((0, httpStatus_1.httpStatusFromError)(error) === 404) {
                            return false;
                        }
                        throw error;
                    }
                },
                async create() {
                    const webhookUrl = this.getNodeWebhookUrl('default');
                    const credentials = await this.getCredentials('openWaApi');
                    const baseUrl = credentials.serverUrl.replace(/\/$/, '');
                    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId'), 'Session ID');
                    const events = this.getNodeParameter('events');
                    const webhookSecret = this.getNodeParameter('webhookSecret', '');
                    if (!events || events.length === 0) {
                        throw new Error('At least one event must be selected');
                    }
                    const body = {
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
                    const webhookId = response.id;
                    if (!webhookId) {
                        throw new n8n_workflow_1.NodeApiError(this.getNode(), { message: 'Webhook created but no ID returned in response' });
                    }
                    const webhookData = this.getWorkflowStaticData('node');
                    // Normalize to string so checkExists/delete comparisons stay consistent.
                    webhookData.webhookId = String(webhookId);
                    // Remember the configuration this registration was made with, so a later
                    // checkExists can detect a stale registration and re-register instead of
                    // silently running with an old secret/events/URL. Only the hash is stored.
                    webhookData.sessionId = sessionId;
                    webhookData.configHash = (0, configHash_1.webhookConfigHash)({
                        url: webhookUrl ?? '',
                        events,
                        secret: webhookSecret,
                        sessionId,
                    });
                    return true;
                },
                async delete() {
                    const webhookData = this.getWorkflowStaticData('node');
                    if (webhookData.webhookId === undefined) {
                        return true;
                    }
                    const credentials = await this.getCredentials('openWaApi');
                    const baseUrl = credentials.serverUrl.replace(/\/$/, '');
                    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId'), 'Session ID');
                    try {
                        await this.helpers.httpRequestWithAuthentication.call(this, 'openWaApi', {
                            method: 'DELETE',
                            url: `${baseUrl}/api/sessions/${sessionId}/webhooks/${encodeURIComponent(webhookData.webhookId)}`,
                            json: true,
                        });
                    }
                    catch (error) {
                        // An already-deleted webhook (404) is fine to swallow; anything else propagates.
                        if ((0, httpStatus_1.httpStatusFromError)(error) !== 404) {
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
    }
    async webhook() {
        const req = this.getRequestObject();
        // Verify the HMAC-SHA256 signature when a secret is configured. OpenWA signs
        // the raw request body and sends it as `X-OpenWA-Signature: sha256=<hex>`.
        const webhookSecret = this.getNodeParameter('webhookSecret', '');
        if (webhookSecret) {
            if (typeof req.readRawBody === 'function' && !req.rawBody) {
                await req.readRawBody();
            }
            // The raw bytes are the only reliable source — OpenWA signs the exact JSON it
            // transmits, and re-serializing a parsed body can reorder keys or change
            // whitespace. Without them the delivery cannot be verified, so reject loudly
            // instead of silently re-serializing (which drops valid deliveries at random).
            if (!req.rawBody) {
                this.logger.warn('OpenWA Trigger cannot verify the delivery signature: the raw request body is unavailable on this n8n version. Upgrade n8n, or clear the Webhook Secret to receive unsigned deliveries.');
                this.getResponseObject().status(401).send('Unauthorized');
                return {
                    noWebhookResponse: true,
                    workflowData: [[]],
                };
            }
            const signatureHeader = req.headers['x-openwa-signature'];
            const signature = typeof signatureHeader === 'string' ? signatureHeader : undefined;
            if (!(0, verifySignature_1.verifyOpenWaSignature)(req.rawBody, webhookSecret, signature)) {
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
        // Optional de-duplication: OpenWA retries failed deliveries with the same
        // deliveryId, so a delivery whose receive-ack was lost arrives twice and
        // would otherwise run the workflow twice. Best-effort: static data is saved
        // per execution, so two retries arriving at the same moment can both pass.
        if (this.getNodeParameter('deduplicateDeliveries', false)) {
            const deliveryId = body.deliveryId;
            if (typeof deliveryId === 'string' && deliveryId) {
                const staticData = this.getWorkflowStaticData('node');
                const seen = staticData.recentDeliveryIds ?? [];
                if (seen.includes(deliveryId)) {
                    this.logger.debug(`OpenWA Trigger: dropping duplicate delivery ${deliveryId}`);
                    return {
                        workflowData: [[]],
                    };
                }
                // Bound the memory: keep only the most recent 500 delivery ids.
                seen.push(deliveryId);
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
exports.OpenWaTrigger = OpenWaTrigger;
//# sourceMappingURL=OpenWaTrigger.node.js.map