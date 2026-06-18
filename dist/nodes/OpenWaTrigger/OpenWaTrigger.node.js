"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenWaTrigger = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const verifySignature_1 = require("./verifySignature");
function sanitizePathParam(value, paramName) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${paramName} cannot be empty`);
    }
    if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
        throw new Error(`${paramName} contains invalid characters`);
    }
    return encodeURIComponent(trimmed);
}
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
                            name: 'Group Join',
                            value: 'group.join',
                            description: 'Triggers when a participant joins a group',
                        },
                        {
                            name: 'Group Leave',
                            value: 'group.leave',
                            description: 'Triggers when a participant leaves a group',
                        },
                        {
                            name: 'Group Update',
                            value: 'group.update',
                            description: 'Triggers when group metadata changes',
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
                    description: 'Optional shared secret. If set, it is registered with OpenWA at webhook creation and every delivery is verified against its X-OpenWA-Signature (HMAC-SHA256) header; deliveries that fail verification are dropped.',
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
                    const sessionId = sanitizePathParam(this.getNodeParameter('sessionId'), 'Session ID');
                    try {
                        await this.helpers.httpRequestWithAuthentication.call(this, 'openWaApi', {
                            method: 'GET',
                            url: `${baseUrl}/api/sessions/${sessionId}/webhooks/${encodeURIComponent(webhookData.webhookId)}`,
                            json: true,
                        });
                        return true;
                    }
                    catch {
                        return false;
                    }
                },
                async create() {
                    const webhookUrl = this.getNodeWebhookUrl('default');
                    const credentials = await this.getCredentials('openWaApi');
                    const baseUrl = credentials.serverUrl.replace(/\/$/, '');
                    const sessionId = sanitizePathParam(this.getNodeParameter('sessionId'), 'Session ID');
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
                    const webhookId = response.id ||
                        response.data?.id;
                    if (!webhookId) {
                        throw new n8n_workflow_1.NodeApiError(this.getNode(), { message: 'Webhook created but no ID returned in response' });
                    }
                    const webhookData = this.getWorkflowStaticData('node');
                    webhookData.webhookId = webhookId;
                    return true;
                },
                async delete() {
                    const webhookData = this.getWorkflowStaticData('node');
                    if (webhookData.webhookId === undefined) {
                        return true;
                    }
                    const credentials = await this.getCredentials('openWaApi');
                    const baseUrl = credentials.serverUrl.replace(/\/$/, '');
                    const sessionId = sanitizePathParam(this.getNodeParameter('sessionId'), 'Session ID');
                    try {
                        await this.helpers.httpRequestWithAuthentication.call(this, 'openWaApi', {
                            method: 'DELETE',
                            url: `${baseUrl}/api/sessions/${sessionId}/webhooks/${encodeURIComponent(webhookData.webhookId)}`,
                            json: true,
                        });
                    }
                    catch (error) {
                        const statusCode = error.httpCode ||
                            error.statusCode;
                        if (statusCode !== 404) {
                            throw error;
                        }
                    }
                    delete webhookData.webhookId;
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
            // The raw bytes are the reliable source — OpenWA signs the exact JSON it
            // sends. Re-serializing the parsed body is only a last-resort fallback.
            const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
            const signatureHeader = req.headers['x-openwa-signature'];
            const signature = typeof signatureHeader === 'string' ? signatureHeader : undefined;
            if (!(0, verifySignature_1.verifyOpenWaSignature)(rawBody, webhookSecret, signature)) {
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
exports.OpenWaTrigger = OpenWaTrigger;
//# sourceMappingURL=OpenWaTrigger.node.js.map