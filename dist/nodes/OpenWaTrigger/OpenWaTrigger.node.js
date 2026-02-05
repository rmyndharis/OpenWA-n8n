"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenWaTrigger = void 0;
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
                    const sessionId = this.getNodeParameter('sessionId');
                    try {
                        await this.helpers.httpRequestWithAuthentication.call(this, 'openWaApi', {
                            method: 'GET',
                            url: `${baseUrl}/api/sessions/${sessionId}/webhooks/${webhookData.webhookId}`,
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
                    const sessionId = this.getNodeParameter('sessionId');
                    const events = this.getNodeParameter('events');
                    const body = {
                        url: webhookUrl,
                        events,
                    };
                    try {
                        const response = await this.helpers.httpRequestWithAuthentication.call(this, 'openWaApi', {
                            method: 'POST',
                            url: `${baseUrl}/api/sessions/${sessionId}/webhooks`,
                            body,
                            json: true,
                        });
                        const webhookData = this.getWorkflowStaticData('node');
                        webhookData.webhookId = response.data?.id || response.id;
                        return true;
                    }
                    catch (error) {
                        return false;
                    }
                },
                async delete() {
                    const webhookData = this.getWorkflowStaticData('node');
                    if (webhookData.webhookId === undefined) {
                        return true;
                    }
                    const credentials = await this.getCredentials('openWaApi');
                    const baseUrl = credentials.serverUrl.replace(/\/$/, '');
                    const sessionId = this.getNodeParameter('sessionId');
                    try {
                        await this.helpers.httpRequestWithAuthentication.call(this, 'openWaApi', {
                            method: 'DELETE',
                            url: `${baseUrl}/api/sessions/${sessionId}/webhooks/${webhookData.webhookId}`,
                            json: true,
                        });
                    }
                    catch {
                        // Webhook might already be deleted, ignore error
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
        // Return the webhook payload as workflow data
        return {
            workflowData: [this.helpers.returnJsonArray(body)],
        };
    }
}
exports.OpenWaTrigger = OpenWaTrigger;
//# sourceMappingURL=OpenWaTrigger.node.js.map