"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenWaTrigger = void 0;
const n8n_workflow_1 = require("n8n-workflow");
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
                            name: 'Session Connected',
                            value: 'session.connected',
                            description: 'Triggers when session is authenticated',
                        },
                        {
                            name: 'Session Disconnected',
                            value: 'session.disconnected',
                            description: 'Triggers when session loses connection',
                        },
                        {
                            name: 'Session QR Ready',
                            value: 'session.qr_ready',
                            description: 'Triggers when QR code is generated',
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
                    description: 'Optional shared secret to verify incoming webhooks. If set, requests must include a matching X-Webhook-Secret header.',
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
                    if (!events || events.length === 0) {
                        throw new Error('At least one event must be selected');
                    }
                    const body = {
                        url: webhookUrl,
                        events,
                    };
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
        const body = req.body;
        // Verify webhook secret if configured
        const webhookSecret = this.getNodeParameter('webhookSecret', '');
        if (webhookSecret) {
            const incomingSecret = req.headers['x-webhook-secret'];
            if (incomingSecret !== webhookSecret) {
                return {
                    webhookResponse: 'Unauthorized',
                    workflowData: [[]],
                };
            }
        }
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