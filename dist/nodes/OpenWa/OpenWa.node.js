"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenWa = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const apiKey_1 = require("./handlers/apiKey");
const automationRule_1 = require("./handlers/automationRule");
const call_1 = require("./handlers/call");
const catalog_1 = require("./handlers/catalog");
const channel_1 = require("./handlers/channel");
const chat_1 = require("./handlers/chat");
const contact_1 = require("./handlers/contact");
const group_1 = require("./handlers/group");
const label_1 = require("./handlers/label");
const media_1 = require("./handlers/media");
const message_1 = require("./handlers/message");
const presence_1 = require("./handlers/presence");
const profile_1 = require("./handlers/profile");
const session_1 = require("./handlers/session");
const status_1 = require("./handlers/status");
const observability_1 = require("./handlers/observability");
const system_1 = require("./handlers/system");
const template_1 = require("./handlers/template");
const webhook_1 = require("./handlers/webhook");
const loadOptions = __importStar(require("./loadOptions"));
const webhookEvents_1 = require("../shared/webhookEvents");
/**
 * Maps each resource to the builder that turns an operation into a request.
 * A resource missing from this map, or a builder that returns null for the
 * operation, surfaces as an "unsupported resource/operation" error.
 */
const RESOURCE_BUILDERS = {
    apiKey: apiKey_1.buildApiKeyRequest,
    automationRule: automationRule_1.buildAutomationRuleRequest,
    call: call_1.buildCallRequest,
    catalog: catalog_1.buildCatalogRequest,
    channel: channel_1.buildChannelRequest,
    chat: chat_1.buildChatRequest,
    contact: contact_1.buildContactRequest,
    group: group_1.buildGroupRequest,
    label: label_1.buildLabelRequest,
    media: media_1.buildMediaRequest,
    message: message_1.buildMessageRequest,
    profile: profile_1.buildProfileRequest,
    session: session_1.buildSessionRequest,
    status: status_1.buildStatusRequest,
    observability: observability_1.buildObservabilityRequest,
    presence: presence_1.buildPresenceRequest,
    system: system_1.buildSystemRequest,
    template: template_1.buildTemplateRequest,
    webhook: webhook_1.buildWebhookRequest,
};
/**
 * A server explanation as a single string.
 *
 * NestJS sends a class-validator rejection as `message: string[]` ("chatId must be a
 * string"), and every string-only guard silently drops that shape, leaving the user
 * with the generic status line and none of the field names that explain it.
 */
function explanationText(value) {
    const text = Array.isArray(value)
        ? value.filter((entry) => typeof entry === 'string').join('; ')
        : value;
    return typeof text === 'string' && text.trim() ? text.trim() : undefined;
}
/**
 * Recovers the server's explanation from a failed binary request.
 *
 * A binary operation asks for an arraybuffer, so when the server answers with an
 * error its JSON body arrives as raw bytes and the message never reaches the user.
 * Get Media is the case that matters: its 404 covers five different situations, and
 * without this the workflow sees only the status code. The decoded body is written
 * back onto the error so the thrown NodeApiError carries it.
 *
 * Decorating an error must never itself throw, so every step is guarded.
 */
function decodeBinaryErrorBody(error) {
    const toText = (value) => {
        let buffer;
        if (Buffer.isBuffer(value)) {
            buffer = value;
        }
        else if (value instanceof ArrayBuffer) {
            buffer = Buffer.from(value);
        }
        else if (ArrayBuffer.isView(value)) {
            buffer = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
        }
        if (!buffer || buffer.length === 0) {
            return undefined;
        }
        const text = buffer.toString('utf8');
        try {
            return JSON.parse(text);
        }
        catch {
            return text;
        }
    };
    /** The server's own sentence out of a decoded JSON error body, or plain text. */
    const explain = (decoded) => {
        if (typeof decoded === 'string') {
            const text = decoded.trim();
            // An intermediary answering 502 sends an HTML page, not a sentence. Copying
            // one whole would put kilobytes of markup on the error and, under Continue On
            // Fail, into stored execution data. A short plain body (Traefik's "Bad
            // Gateway") is still worth keeping.
            return text && text.length <= 300 && !text.startsWith('<') ? text : undefined;
        }
        if (decoded && typeof decoded === 'object') {
            return explanationText(decoded.message);
        }
        return undefined;
    };
    try {
        const holder = error;
        if (holder && typeof holder === 'object') {
            let explanation;
            for (const carrier of [holder.response, holder.cause?.response]) {
                if (carrier && typeof carrier === 'object') {
                    const decoded = toText(carrier.body) ?? toText(carrier.data);
                    if (decoded !== undefined) {
                        carrier.body = decoded;
                        carrier.data = decoded;
                        explanation = explanation ?? explain(decoded);
                    }
                }
            }
            const topLevel = toText(holder.error);
            if (topLevel !== undefined) {
                holder.error = topLevel;
                explanation = explanation ?? explain(topLevel);
            }
            if (holder.context && typeof holder.context === 'object') {
                const decoded = toText(holder.context.data);
                if (decoded !== undefined) {
                    holder.context.data = decoded;
                    explanation = explanation ?? explain(decoded);
                }
            }
            // Put the recovered sentence where the user actually reads it. On an already
            // wrapped error the message is fixed, so the description is the only channel
            // left; on a raw request error NodeApiError adopts this description when it
            // wraps, so the same assignment serves both.
            if (explanation !== undefined) {
                holder.description = explanation;
            }
        }
    }
    catch {
        // Leave the error exactly as it arrived rather than losing it.
    }
    return error;
}
class OpenWa {
    constructor() {
        this.description = {
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
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
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
                        { name: 'API Key', value: 'apiKey' },
                        { name: 'Automation Rule', value: 'automationRule' },
                        { name: 'Call', value: 'call' },
                        { name: 'Catalog', value: 'catalog' },
                        { name: 'Channel', value: 'channel' },
                        { name: 'Chat', value: 'chat' },
                        { name: 'Contact', value: 'contact' },
                        { name: 'Group', value: 'group' },
                        { name: 'Label', value: 'label' },
                        { name: 'Media', value: 'media' },
                        { name: 'Message', value: 'message' },
                        { name: 'Observability', value: 'observability' },
                        { name: 'Presence', value: 'presence' },
                        { name: 'Profile', value: 'profile' },
                        { name: 'Session', value: 'session' },
                        { name: 'Status', value: 'status' },
                        { name: 'System', value: 'system' },
                        { name: 'Template', value: 'template' },
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
                        {
                            name: 'Get Config',
                            value: 'getConfig',
                            action: 'Get the tunable configuration for a session',
                        },
                        {
                            name: 'Get Proxy',
                            value: 'getProxy',
                            action: 'Get the egress proxy for a session',
                        },
                        { name: 'Get QR', value: 'getQr', action: 'Get the QR code for authentication' },
                        {
                            name: 'Get Stats Overview',
                            value: 'getStatsOverview',
                            action: 'Get an overview of all sessions',
                        },
                        { name: 'Get Status', value: 'getStatus', action: 'Get session status' },
                        { name: 'List All', value: 'listAll', action: 'List all sessions' },
                        { name: 'Log Out', value: 'logout', action: 'Log out and unlink this device' },
                        {
                            name: 'Request Pairing Code',
                            value: 'requestPairingCode',
                            action: 'Request a phone pairing code',
                        },
                        { name: 'Start', value: 'start', action: 'Start a session' },
                        { name: 'Stop', value: 'stop', action: 'Stop a session' },
                        {
                            name: 'Update Config',
                            value: 'updateConfig',
                            action: 'Update the tunable configuration for a session',
                        },
                        {
                            name: 'Update Proxy',
                            value: 'updateProxy',
                            action: 'Update the egress proxy for a session',
                        },
                    ],
                    default: 'getStatus',
                },
                {
                    displayName: 'Session Name or ID',
                    name: 'sessionId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getSessions',
                    },
                    default: '',
                    required: true,
                    displayOptions: {
                        show: {
                            resource: ['session'],
                            operation: [
                                'getStatus',
                                'start',
                                'stop',
                                'forceKill',
                                'delete',
                                'getQr',
                                'requestPairingCode',
                                'logout',
                                'getConfig',
                                'updateConfig',
                                'getProxy',
                                'updateProxy',
                            ],
                        },
                    },
                    description: 'The UUID of the session (returned by Create / Get Status / List All). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
                    description: 'Optional session config as a JSON object. The server reads exactly three keys and silently ignores anything else: autoRejectCalls (boolean, default false), maxReconnectAttempts (0-20, default unlimited) and reconnectBaseDelay (1000-300000 ms, default 5000). A proxy belongs in the Proxy URL field, not here. Example: {"autoRejectCalls":true,"maxReconnectAttempts":5}',
                },
                {
                    displayName: 'Proxy URL',
                    name: 'proxyUrl',
                    type: 'string',
                    default: '',
                    placeholder: 'socks5://127.0.0.1:1080',
                    displayOptions: {
                        show: { resource: ['session'], operation: ['create', 'updateProxy'] },
                    },
                    description: 'Egress proxy for this session, as a full URL with its scheme (http, https, socks4 or socks5), at most 255 characters. Credentials in the URL work on Baileys; whatsapp-web.js cannot authenticate a SOCKS proxy. Read the stored value back with Get Proxy, which reports the scheme, host and whether credentials are embedded but never the credentials themselves (server ≥ 0.23.4). Update Proxy writes it without restarting anything, so a change takes effect on the next Start. An unreachable proxy does not fail fast: no QR is ever delivered and Start times out after about 30 seconds.',
                },
                {
                    displayName: 'Clear Proxy',
                    name: 'proxyClear',
                    type: 'boolean',
                    default: false,
                    displayOptions: {
                        show: { resource: ['session'], operation: ['updateProxy'] },
                    },
                    description: 'Whether to remove the stored proxy instead of setting one. The server spells removal as an explicit null, which a text field cannot express, so Proxy URL is ignored while this is on.',
                },
                {
                    displayName: 'Config Fields',
                    name: 'sessionConfigFields',
                    type: 'collection',
                    placeholder: 'Add Field',
                    default: {},
                    displayOptions: {
                        show: { resource: ['session'], operation: ['updateConfig'] },
                    },
                    description: 'Only the fields you add are sent. Anything you leave out keeps its stored value.',
                    options: [
                        {
                            displayName: 'Auto Reject Calls',
                            name: 'autoRejectCalls',
                            type: 'boolean',
                            default: false,
                            description: 'Whether to decline every incoming call automatically. Re-read on each call, so it applies immediately.',
                        },
                        {
                            displayName: 'Max Reconnect Attempts',
                            name: 'maxReconnectAttempts',
                            type: 'number',
                            typeOptions: { minValue: -1, maxValue: 20 },
                            default: -1,
                            description: 'How many consecutive reconnects to attempt. Use -1 for unlimited, which is the default and the only way back to it once a cap is set. 0 disables reconnection entirely, leaving the session down until it is started by hand. Applies from the next Start, not to a reconnect already under way.',
                        },
                        {
                            displayName: 'Reconnect Base Delay (Ms)',
                            name: 'reconnectBaseDelay',
                            type: 'number',
                            typeOptions: { minValue: 1000, maxValue: 300000 },
                            default: 5000,
                            description: 'Base backoff between reconnect attempts, in milliseconds. Applies from the next Start.',
                        },
                    ],
                },
                {
                    displayName: "Log Out asks WhatsApp to unlink this device, wipes the stored credentials and clears the phone number, so the next Start needs a fresh QR or pairing code. It needs a running session: on a stopped one it fails, so do not put a Stop in front of it. Stop keeps the credentials and reconnects without a QR; Delete removes the session and its data but never tells WhatsApp to unlink, leaving the device in the account's Linked Devices list.",
                    name: 'sessionLogoutNotice',
                    type: 'notice',
                    default: '',
                    displayOptions: { show: { resource: ['session'], operation: ['logout'] } },
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
                {
                    displayName: 'Options',
                    name: 'sessionListOptions',
                    type: 'collection',
                    placeholder: 'Add Option',
                    default: {},
                    displayOptions: {
                        show: { resource: ['session'], operation: ['listAll'] },
                    },
                    options: [
                        {
                            displayName: 'Limit',
                            name: 'limit',
                            type: 'number',
                            typeOptions: { minValue: 1 },
                            default: 50,
                            description: 'Max number of results to return',
                        },
                        {
                            displayName: 'Offset',
                            name: 'offset',
                            type: 'number',
                            typeOptions: { minValue: 0 },
                            default: 0,
                            description: 'Number of sessions to skip before collecting the result set',
                        },
                    ],
                },
                // ============== MEDIA OPERATIONS ==============
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: { show: { resource: ['media'] } },
                    options: [
                        {
                            name: 'Check Availability',
                            value: 'checkConversion',
                            action: 'Check whether media conversion is available',
                        },
                        {
                            name: 'Convert to Video',
                            value: 'convertVideo',
                            action: 'Convert video into a compatible format',
                        },
                        {
                            name: 'Convert to Voice Note',
                            value: 'convertVoice',
                            action: 'Convert audio into a voice note',
                        },
                    ],
                    default: 'convertVoice',
                },
                {
                    displayName: 'Session Name or ID',
                    name: 'sessionId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getSessions',
                    },
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['media'] } },
                    description: 'The ID of the session. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Media Source',
                    name: 'mediaConvertSource',
                    type: 'options',
                    options: [
                        { name: 'Binary', value: 'binary' },
                        { name: 'URL', value: 'url' },
                        { name: 'Base64', value: 'base64' },
                    ],
                    default: 'binary',
                    displayOptions: {
                        show: { resource: ['media'], operation: ['convertVoice', 'convertVideo'] },
                    },
                    description: 'Where the media to convert comes from',
                },
                {
                    displayName: 'Input Binary Field',
                    name: 'mediaConvertBinaryProperty',
                    type: 'string',
                    default: 'data',
                    required: true,
                    displayOptions: {
                        show: {
                            resource: ['media'],
                            operation: ['convertVoice', 'convertVideo'],
                            mediaConvertSource: ['binary'],
                        },
                    },
                    description: 'The name of the input binary field holding the media',
                },
                {
                    displayName: 'Media URL',
                    name: 'mediaConvertUrl',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: {
                        show: {
                            resource: ['media'],
                            operation: ['convertVoice', 'convertVideo'],
                            mediaConvertSource: ['url'],
                        },
                    },
                    description: 'Public URL of the media to convert, fetched by the server',
                },
                {
                    displayName: 'Base64 Data',
                    name: 'mediaConvertBase64',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: {
                        show: {
                            resource: ['media'],
                            operation: ['convertVoice', 'convertVideo'],
                            mediaConvertSource: ['base64'],
                        },
                    },
                    description: 'Base64 encoded media to convert',
                },
                {
                    displayName: 'Conversion returns <code>base64</code> and <code>mimetype</code> ready to feed into a send. Convert to Voice Note produces Ogg/Opus for Message > Send Audio (Base64 source, Send as Voice Note on) or Status > Send Voice; Convert to Video produces an MP4 for Message > Send Video. Nothing else in the pipeline transcodes, so without this an MP3 sent as a voice note produces a microphone bubble that will not play. Conversion is optional on the server and needs ffmpeg: use Check Availability first, and read a 503 as conversion being disabled or busy rather than as a bad request. No MIME type is sent, because the server reads it from the bytes.',
                    name: 'mediaConvertNotice',
                    type: 'notice',
                    default: '',
                    displayOptions: {
                        show: { resource: ['media'], operation: ['convertVoice', 'convertVideo'] },
                    },
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
                        { name: 'Edit', value: 'edit', action: 'Edit a sent message' },
                        { name: 'Forward', value: 'forward', action: 'Forward a message to another chat' },
                        { name: 'Get Batch Status', value: 'getBatchStatus', action: 'Get bulk batch status' },
                        { name: 'Get History', value: 'getHistory', action: 'Get the message history of a chat' },
                        {
                            name: 'Get Media',
                            value: 'getMedia',
                            action: 'Download the stored media of a message',
                        },
                        {
                            name: 'Get Reactions',
                            value: 'getReactions',
                            action: 'Get the reactions on a message',
                        },
                        { name: 'List', value: 'list', action: 'List stored messages' },
                        { name: 'Pin', value: 'pin', action: 'Pin a message in its chat' },
                        { name: 'React', value: 'react', action: 'React to a message' },
                        { name: 'Reply', value: 'reply', action: 'Reply to a message' },
                        { name: 'Send Audio', value: 'sendAudio', action: 'Send an audio or voice message' },
                        { name: 'Send Bulk', value: 'sendBulk', action: 'Send messages in bulk' },
                        { name: 'Send Contact', value: 'sendContact', action: 'Send a contact card' },
                        { name: 'Send Document', value: 'sendDocument', action: 'Send a document' },
                        { name: 'Send Image', value: 'sendImage', action: 'Send an image' },
                        { name: 'Send Location', value: 'sendLocation', action: 'Send a location' },
                        { name: 'Send Poll', value: 'sendPoll', action: 'Send a poll' },
                        {
                            name: 'Send Product',
                            value: 'sendProduct',
                            action: 'Send a product card from the catalog',
                        },
                        { name: 'Send Sticker', value: 'sendSticker', action: 'Send a sticker' },
                        { name: 'Send Template', value: 'sendTemplate', action: 'Send a rendered template' },
                        { name: 'Send Text', value: 'sendText', action: 'Send a text message' },
                        { name: 'Send Video', value: 'sendVideo', action: 'Send a video' },
                        { name: 'Star', value: 'star', action: 'Star or unstar a message' },
                        { name: 'Unpin', value: 'unpin', action: 'Remove the pin from a message' },
                        { name: 'Vote Poll', value: 'votePoll', action: 'Cast a vote on a poll' },
                    ],
                    default: 'sendText',
                },
                {
                    displayName: 'Session Name or ID',
                    name: 'sessionId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getSessions',
                    },
                    default: '',
                    required: true,
                    displayOptions: {
                        show: { resource: ['message'] },
                    },
                    description: 'The ID of the session to send from. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Chat Name or ID',
                    name: 'chatId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getChats',
                        loadOptionsDependsOn: ['sessionId'],
                    },
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
                                'sendPoll',
                                'sendTemplate',
                                'reply',
                                'react',
                                'delete',
                                'edit',
                                'getHistory',
                                'getReactions',
                                'getMedia',
                                'pin',
                                'unpin',
                                'star',
                                'votePoll',
                                'sendProduct',
                            ],
                        },
                    },
                    description: 'The recipient chat ID (e.g., 628123456789@c.us for personal, or ...@g.us for groups). Only the first 1000 are listed; use an expression for anything beyond that. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
                        show: { resource: ['message'], operation: ['sendText', 'reply', 'edit'] },
                    },
                    description: 'The text message to send. For Edit, this replaces the existing message body.',
                },
                // Send Image fields
                {
                    displayName: 'Image Source',
                    name: 'imageSource',
                    type: 'options',
                    options: [
                        { name: 'Base64', value: 'base64' },
                        { name: 'Binary Data', value: 'binary' },
                        { name: 'URL', value: 'url' },
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
                        { name: 'Base64', value: 'base64' },
                        { name: 'Binary Data', value: 'binary' },
                        { name: 'URL', value: 'url' },
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
                    description: 'MIME type of the base64 document. OpenWA requires this whenever base64 data is sent.',
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
                        { name: 'Base64', value: 'base64' },
                        { name: 'Binary Data', value: 'binary' },
                        { name: 'URL', value: 'url' },
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
                    description: 'MIME type of the base64 audio. OpenWA requires this whenever base64 data is sent. Use audio/ogg; codecs=opus for a voice note; for a plain audio file set its real type (e.g. audio/mpeg).',
                },
                {
                    displayName: 'Send as Voice Note',
                    name: 'sendAsVoiceNote',
                    type: 'boolean',
                    default: false,
                    displayOptions: {
                        show: { resource: ['message'], operation: ['sendAudio'] },
                    },
                    description: 'Whether to deliver this as a true WhatsApp voice note (PTT — mic bubble with a waveform) instead of a plain audio file. Requires OGG/Opus audio (audio/ogg; codecs=opus) and an OpenWA server ≥ v0.7.17; leave off on older servers.',
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
                    description: 'Latitude coordinate. Both coordinates default to 0, and 0,0 is a real point in the Atlantic that the server accepts, so an untouched pair sends a valid but wrong location rather than failing.',
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
                {
                    displayName: 'Address',
                    name: 'locationAddress',
                    type: 'string',
                    default: '',
                    placeholder: 'Jl. Sudirman No. 1, Jakarta',
                    displayOptions: { show: { resource: ['message'], operation: ['sendLocation'] } },
                    description: 'Optional street address, rendered on the line under the location name. Both engines carry it.',
                },
                // Send Video fields
                {
                    displayName: 'Video Source',
                    name: 'videoSource',
                    type: 'options',
                    options: [
                        { name: 'Base64', value: 'base64' },
                        { name: 'Binary Data', value: 'binary' },
                        { name: 'URL', value: 'url' },
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
                        { name: 'Base64', value: 'base64' },
                        { name: 'Binary Data', value: 'binary' },
                        { name: 'URL', value: 'url' },
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
                    description: 'MIME type of the base64 sticker. WhatsApp requires image/webp. OpenWA requires this whenever base64 data is sent.',
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
                    description: 'Phone number for the shared contact, including country code (it is not auto-prefixed)',
                },
                {
                    displayName: 'Quoted Message ID',
                    name: 'sendQuotedMessageId',
                    type: 'string',
                    default: '',
                    placeholder: 'true_628123456789@c.us_3EB0...',
                    displayOptions: {
                        show: {
                            resource: ['message'],
                            operation: [
                                'sendText',
                                'sendImage',
                                'sendVideo',
                                'sendAudio',
                                'sendDocument',
                                'sendSticker',
                                'sendLocation',
                                'sendContact',
                                'sendPoll',
                            ],
                        },
                    },
                    description: 'Optionally quote an earlier message, so a reply can carry media, a location, a contact or a poll rather than only text. Leave empty to send without a quote. An ID the engine cannot resolve fails the send outright rather than delivering it unquoted, and Baileys can only quote a message it has already stored.',
                },
                {
                    displayName: 'Link Preview',
                    name: 'linkPreview',
                    type: 'options',
                    options: [
                        { name: 'Engine Default', value: 'default' },
                        { name: 'Generate a Preview', value: 'yes' },
                        { name: 'No Preview', value: 'no' },
                    ],
                    default: 'default',
                    displayOptions: {
                        show: { resource: ['message'], operation: ['sendText', 'sendTemplate'] },
                    },
                    description: 'Whether a URL in the message renders a preview card. The engines differ on what the default means: whatsapp-web.js builds one unless told not to, while on Baileys previews are opt-in. Choosing Generate a Preview on Baileys makes the server fetch every URL in the message before sending, which stalls the send on a slow or dead link.',
                },
                {
                    displayName: 'Custom Link Preview',
                    name: 'customLinkPreview',
                    type: 'collection',
                    placeholder: 'Add Field',
                    default: {},
                    displayOptions: { show: { resource: ['message'], operation: ['sendText'] } },
                    description: 'Attach a preview card of your own instead of letting the engine build one. Baileys only: whatsapp-web.js answers 501 rather than dropping it silently. Both URL and Title must be set or nothing is sent, and the URL must also appear in the message text or WhatsApp renders no card at all.',
                    options: [
                        {
                            displayName: 'URL',
                            name: 'previewUrl',
                            type: 'string',
                            default: '',
                            description: 'The URL the card points at. It must also appear literally in the message text.',
                        },
                        {
                            displayName: 'Title',
                            name: 'previewTitle',
                            type: 'string',
                            default: '',
                            description: 'Card title. WhatsApp renders no preview without one.',
                        },
                        {
                            displayName: 'Description',
                            name: 'previewDescription',
                            type: 'string',
                            default: '',
                            description: 'Optional line under the title',
                        },
                    ],
                },
                // Mentions (every send whose DTO carries it, plus Reply and Edit)
                {
                    displayName: 'Mentions',
                    name: 'mentions',
                    type: 'string',
                    default: '',
                    placeholder: '628123456789@c.us, 628987654321@c.us',
                    displayOptions: {
                        show: {
                            resource: ['message'],
                            operation: [
                                'sendText',
                                'sendImage',
                                'sendDocument',
                                'sendVideo',
                                'sendAudio',
                                'sendSticker',
                                'sendTemplate',
                                'reply',
                                'edit',
                            ],
                        },
                    },
                    description: 'WhatsApp IDs to @mention. Accepts a comma-separated list, a JSON array, or an expression resolving to an array. The message text or caption must also contain a matching @-mention token (e.g. @628123456789) for it to render. On Edit the tags are re-applied rather than preserved, because an edit replaces the message content: list every ID the edited message should still tag, or leave empty to drop the tags the original carried.',
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
                    description: 'The full serialized ID of the message to quote, as returned by send operations or delivered by the Trigger',
                },
                {
                    displayName: 'Message ID',
                    name: 'messageId',
                    type: 'string',
                    default: '',
                    required: true,
                    placeholder: 'true_628123456789@c.us_3EB0...',
                    displayOptions: {
                        show: {
                            resource: ['message'],
                            operation: [
                                'react',
                                'delete',
                                'edit',
                                'forward',
                                'getReactions',
                                'getMedia',
                                'pin',
                                'unpin',
                                'star',
                                'votePoll',
                            ],
                        },
                    },
                    description: 'The full serialized ID of the target message, as returned by send operations or delivered by the Trigger',
                },
                {
                    displayName: "A 404 here does not only mean the message is missing. The same answer covers a message with no media, media whose download was disabled or exceeded the storage cap, and media sent by URL, whose bytes the gateway never stores. Media sent from a binary field or base64 is retrievable; the same send done from a URL is not. The response is raw bytes, so the gateway's own sentence is decoded out of them and surfaced on the error description rather than in the item body.",
                    name: 'messageGetMediaNotice',
                    type: 'notice',
                    default: '',
                    displayOptions: { show: { resource: ['message'], operation: ['getMedia'] } },
                },
                {
                    displayName: 'Pin Duration',
                    name: 'pinDurationSeconds',
                    type: 'options',
                    options: [
                        { name: '24 Hours', value: 86400 },
                        { name: '7 Days', value: 604800 },
                        { name: '30 Days', value: 2592000 },
                    ],
                    default: 86400,
                    displayOptions: { show: { resource: ['message'], operation: ['pin'] } },
                    description: 'How long the pin lasts. WhatsApp accepts only these three windows. There is no way to read a pin back, so a workflow cannot check or refresh one.',
                },
                {
                    displayName: 'Star',
                    name: 'star',
                    type: 'boolean',
                    default: true,
                    displayOptions: { show: { resource: ['message'], operation: ['star'] } },
                    description: 'Whether to star the message. Turn off to remove the star. A star is private to this account and is never visible to the other party.',
                },
                {
                    displayName: 'Selected Options',
                    name: 'pollVoteOptions',
                    type: 'string',
                    default: '',
                    placeholder: 'Pizza, Sushi',
                    displayOptions: { show: { resource: ['message'], operation: ['votePoll'] } },
                    description: "The option texts to select, at most 12. Accepts a comma-separated list, a JSON array, or an expression resolving to an array. These are matched by text against the poll's own options, so they must match exactly: a different case or a stray space selects nothing while still reporting success. An option whose own text contains a comma must be supplied as a JSON array, since a comma-separated list would split it. The vote replaces any previous selection, and an empty list clears it. whatsapp-web.js only: Baileys answers 501.",
                },
                {
                    displayName: 'Product ID',
                    name: 'productId',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['message'], operation: ['sendProduct'] } },
                    description: "The ID of the product in this account's catalog. A product with no image cannot be sent as a card, which the server reports as a 400.",
                },
                {
                    displayName: 'Message',
                    name: 'productBody',
                    type: 'string',
                    typeOptions: { rows: 2 },
                    default: '',
                    displayOptions: { show: { resource: ['message'], operation: ['sendProduct'] } },
                    description: 'Optional text to send alongside the product card',
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
                    description: 'Whether to revoke the message for everyone. Turn off to remove only your own local copy.',
                },
                // Send Bulk fields
                {
                    displayName: 'Messages (JSON)',
                    name: 'bulkMessages',
                    type: 'json',
                    default: '[]',
                    required: true,
                    displayOptions: { show: { resource: ['message'], operation: ['sendBulk'] } },
                    description: 'Array of up to 100 items. Text item: { "chatId": "628...@c.us", "type": "text", "content": { "text": "hi" } }. Media item: same shape with "type" set to image/video/audio/document and the media nested under that key in "content" — provide it as a remote link or a "base64" field (base64 also needs "mimetype"), plus an optional "caption". No binary source in bulk. Items that are exactly alike (same chat ID, type, content, and variables) are collapsed by the server, keeping the first, so the batch total it reports back can be lower than the number of items sent.',
                },
                {
                    displayName: 'Batch ID',
                    name: 'batchId',
                    type: 'string',
                    default: '',
                    displayOptions: { show: { resource: ['message'], operation: ['sendBulk'] } },
                    description: 'Optional custom batch ID (must be unique per session). Leave empty to let the server generate one.',
                },
                {
                    displayName: 'Options',
                    name: 'bulkOptions',
                    type: 'collection',
                    placeholder: 'Add Option',
                    default: {},
                    displayOptions: { show: { resource: ['message'], operation: ['sendBulk'] } },
                    description: 'If left empty, the server applies its own defaults (delay 3000 ms, randomize on, stop-on-error off)',
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
                // Send Poll fields
                {
                    displayName: 'Question',
                    name: 'pollName',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['message'], operation: ['sendPoll'] } },
                    description: 'The poll question',
                },
                {
                    displayName: 'Options',
                    name: 'pollOptions',
                    type: 'string',
                    default: '',
                    required: true,
                    placeholder: 'Pizza, Sushi, Salad',
                    displayOptions: { show: { resource: ['message'], operation: ['sendPoll'] } },
                    description: 'The answers to vote on (2–12). Accepts a comma-separated list, a JSON array, or an expression resolving to an array. An answer whose own text contains a comma must be supplied as a JSON array, since a comma-separated list would split it into two answers and the poll would still post.',
                },
                {
                    displayName: 'Allow Multiple Answers',
                    name: 'allowMultipleAnswers',
                    type: 'boolean',
                    default: false,
                    displayOptions: { show: { resource: ['message'], operation: ['sendPoll'] } },
                    description: 'Whether voters may pick several options instead of exactly one',
                },
                // Send Template fields
                {
                    displayName: 'Template Name or ID',
                    name: 'sendTemplateId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getTemplates',
                        loadOptionsDependsOn: ['sessionId'],
                    },
                    default: '',
                    displayOptions: { show: { resource: ['message'], operation: ['sendTemplate'] } },
                    description: 'ID of the template to render. Provide either this or Template Name — the ID wins if both are set. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Template Name',
                    name: 'sendTemplateName',
                    type: 'string',
                    default: '',
                    displayOptions: { show: { resource: ['message'], operation: ['sendTemplate'] } },
                    description: 'Name of the template to render. Used only when Template ID is empty.',
                },
                {
                    displayName: 'Variables (JSON)',
                    name: 'templateVars',
                    type: 'json',
                    default: '',
                    displayOptions: { show: { resource: ['message'], operation: ['sendTemplate'] } },
                    description: 'Values substituted into the template\'s {{placeholder}} tokens, as a JSON object, e.g. {"name":"Alice"}',
                },
                // Forward fields
                {
                    displayName: 'From Chat Name or ID',
                    name: 'fromChatId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getChats',
                        loadOptionsDependsOn: ['sessionId'],
                    },
                    default: '',
                    required: true,
                    placeholder: '628123456789@c.us',
                    displayOptions: { show: { resource: ['message'], operation: ['forward'] } },
                    description: 'The chat the message currently lives in. Only the first 1000 are listed; use an expression for anything beyond that. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'To Chat Name or ID',
                    name: 'toChatId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getChats',
                        loadOptionsDependsOn: ['sessionId'],
                    },
                    default: '',
                    required: true,
                    placeholder: '628987654321@c.us',
                    displayOptions: { show: { resource: ['message'], operation: ['forward'] } },
                    description: 'The chat to forward the message to. Only the first 1000 are listed; use an expression for anything beyond that. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                // List / history filters
                {
                    displayName: 'Options',
                    name: 'messageListOptions',
                    type: 'collection',
                    placeholder: 'Add Option',
                    default: {},
                    displayOptions: { show: { resource: ['message'], operation: ['list'] } },
                    options: [
                        {
                            displayName: 'After Row ID',
                            name: 'after',
                            type: 'string',
                            default: '',
                            description: 'Keyset cursor: the row ID of the last message of the previous page, taken from the list response. It is the ID the gateway assigns the stored row, not the WhatsApp message ID that Get Reactions and Edit take. Anchors the window to a row rather than to a count, so a message arriving mid-walk cannot shift the page boundary the way Offset does. Takes precedence over Offset. A value that is not a row ID in this session is refused with an error rather than answering an empty page, so a stale or foreign cursor cannot look like the end of the history. Requires server ≥ 0.23.4: an older server reads this route query loosely and ignores the cursor, silently falling back to Offset paging.',
                        },
                        {
                            displayName: 'Chat Name or ID',
                            name: 'chatId',
                            type: 'options',
                            typeOptions: {
                                loadOptionsMethod: 'getChats',
                                loadOptionsDependsOn: ['sessionId'],
                            },
                            default: '',
                            description: 'Only return messages from this chat. Only the first 1000 are listed; use an expression for anything beyond that. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                        },
                        {
                            displayName: 'From',
                            name: 'from',
                            type: 'string',
                            default: '',
                            description: 'Only return messages from this sender',
                        },
                        {
                            displayName: 'Inline Media',
                            name: 'inlineMedia',
                            type: 'boolean',
                            default: true,
                            description: 'Whether to carry media payloads inline in each returned message. Turn this off to get only the { omitted, sizeBytes } marker and fetch the bytes with Get Media instead. The inline-media budget is spent per response, so a paged walk re-spends it on every page. Requires server ≥ 0.23.4; an older server ignores this and always inlines.',
                        },
                        {
                            displayName: 'Limit',
                            name: 'limit',
                            type: 'number',
                            typeOptions: { minValue: 1, maxValue: 100 },
                            default: 50,
                            description: 'Max number of results to return',
                        },
                        {
                            displayName: 'Offset',
                            name: 'offset',
                            type: 'number',
                            typeOptions: { minValue: 0 },
                            default: 0,
                            description: 'Number of messages to skip before collecting the result set. Ignored when After Row ID is set, and prone to drift on a live chat: a message arriving between pages shifts every later offset.',
                        },
                    ],
                },
                {
                    displayName: "Get History reads the conversation from the device and is whatsapp-web.js only; the Baileys engine answers 501. Message > List serves the gateway's own stored copy on both engines.",
                    name: 'getHistoryEngineNotice',
                    type: 'notice',
                    default: '',
                    displayOptions: { show: { resource: ['message'], operation: ['getHistory'] } },
                },
                {
                    displayName: 'Options',
                    name: 'historyOptions',
                    type: 'collection',
                    placeholder: 'Add Option',
                    default: {},
                    displayOptions: { show: { resource: ['message'], operation: ['getHistory'] } },
                    options: [
                        {
                            displayName: 'Deep',
                            name: 'deep',
                            type: 'boolean',
                            default: false,
                            description: 'Whether to pull older messages from the device instead of only what the server has stored. It raises the Limit ceiling from 100 to 2000 and forces metadata-only, so Include Media is ignored while this is on. A large deep read is slow and raises the risk of WhatsApp rate-limiting the account.',
                        },
                        {
                            displayName: 'Include Media',
                            name: 'includeMedia',
                            type: 'boolean',
                            default: false,
                            description: 'Whether to include media payloads in the returned messages. Ignored when Deep is on.',
                        },
                        {
                            displayName: 'Limit',
                            name: 'limit',
                            type: 'number',
                            typeOptions: { minValue: 1, maxValue: 2000 },
                            default: 50,
                            description: 'Max number of results to return',
                        },
                    ],
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
                        { name: 'Delete', value: 'delete', action: 'Delete a contact from the addressbook' },
                        { name: 'Get Info', value: 'getInfo', action: 'Get contact information' },
                        { name: 'Get Phone', value: 'getPhone', action: 'Resolve a contact phone number' },
                        {
                            name: 'Get Profile Picture',
                            value: 'getProfilePicture',
                            action: 'Get a contact profile picture',
                        },
                        {
                            name: 'Get Profile Pictures',
                            value: 'getProfilePictures',
                            action: 'Get profile pictures for many contacts',
                        },
                        { name: 'List', value: 'list', action: 'List all contacts' },
                        { name: 'List Blocked', value: 'listBlocked', action: 'List blocked contacts' },
                        { name: 'Save', value: 'save', action: 'Save a contact to the addressbook' },
                        { name: 'Unblock', value: 'unblock', action: 'Unblock a contact' },
                    ],
                    default: 'checkExists',
                },
                {
                    displayName: 'Session Name or ID',
                    name: 'sessionId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getSessions',
                    },
                    default: '',
                    required: true,
                    displayOptions: {
                        show: { resource: ['contact'] },
                    },
                    description: 'The ID of the session. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
                    description: 'Phone number in international format. Spaces, +, hyphens and parentheses are stripped before the check, so leaving them in is fine.',
                },
                {
                    displayName: 'Contact Name or ID',
                    name: 'contactId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getContacts',
                        loadOptionsDependsOn: ['sessionId'],
                    },
                    default: '',
                    required: true,
                    placeholder: '628123456789@c.us',
                    displayOptions: {
                        show: {
                            resource: ['contact'],
                            operation: [
                                'getInfo',
                                'block',
                                'unblock',
                                'getProfilePicture',
                                'getPhone',
                                'save',
                                'delete',
                            ],
                        },
                    },
                    description: 'The contact ID (WhatsApp JID, e.g. 628123456789@c.us). Only the first 1000 are listed; use an expression for anything beyond that. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'First Name',
                    name: 'contactFirstName',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['contact'], operation: ['save'] } },
                    description: 'Given name for the addressbook entry (max 100 characters). Saving overwrites the whole entry, so leaving Last Name empty clears any last name already stored.',
                },
                {
                    displayName: 'Last Name',
                    name: 'contactLastName',
                    type: 'string',
                    default: '',
                    displayOptions: { show: { resource: ['contact'], operation: ['save'] } },
                    description: 'Family name for the addressbook entry (max 100 characters)',
                },
                {
                    displayName: "The addressbook is keyed by phone number, so this needs a plain <code>@c.us</code> contact ID. A privacy ID (<code>@lid</code>), a group, or a channel is refused. This writes to the WhatsApp account's own addressbook and syncs to the linked devices, so it is a real change to the account, not a note kept on the gateway. It is not added to the phone's native contacts.",
                    name: 'contactSaveNotice',
                    type: 'notice',
                    default: '',
                    displayOptions: { show: { resource: ['contact'], operation: ['save'] } },
                },
                {
                    displayName: 'Contact IDs',
                    name: 'contactIds',
                    type: 'string',
                    default: '',
                    required: true,
                    placeholder: '628123456789@c.us, 628987654321@c.us',
                    displayOptions: {
                        show: { resource: ['contact'], operation: ['getProfilePictures'] },
                    },
                    description: 'The contacts to fetch pictures for (max 50). Accepts a comma-separated list, a JSON array, or an expression resolving to an array.',
                },
                {
                    displayName: 'Options',
                    name: 'contactListOptions',
                    type: 'collection',
                    placeholder: 'Add Option',
                    default: {},
                    displayOptions: {
                        show: { resource: ['contact'], operation: ['list'] },
                    },
                    options: [
                        {
                            displayName: 'Limit',
                            name: 'limit',
                            type: 'number',
                            typeOptions: { minValue: 1 },
                            default: 50,
                            description: 'Max number of results to return',
                        },
                        {
                            displayName: 'Offset',
                            name: 'offset',
                            type: 'number',
                            typeOptions: { minValue: 0 },
                            default: 0,
                            description: 'Number of contacts to skip before collecting the result set',
                        },
                    ],
                },
                // ============== GROUP OPERATIONS ==============
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: {
                        show: { resource: ['group'] },
                    },
                    options: [
                        {
                            name: 'Add Participants',
                            value: 'addParticipants',
                            action: 'Add participants to a group',
                        },
                        {
                            name: 'Approve Membership Requests',
                            value: 'approveMembershipRequests',
                            action: 'Approve pending join requests',
                        },
                        { name: 'Create', value: 'create', action: 'Create a group' },
                        {
                            name: 'Delete Picture',
                            value: 'deletePicture',
                            action: 'Remove the group picture',
                        },
                        {
                            name: 'Demote Participants',
                            value: 'demoteParticipants',
                            action: 'Demote participants from admin',
                        },
                        { name: 'Get', value: 'get', action: 'Get group info including participants' },
                        { name: 'Get Invite Code', value: 'getInviteCode', action: 'Get the group invite code' },
                        {
                            name: 'Get Join Info',
                            value: 'getJoinInfo',
                            action: 'Preview a group from its invite code without joining',
                        },
                        {
                            name: 'Get Membership Requests',
                            value: 'getMembershipRequests',
                            action: 'List pending join requests',
                        },
                        { name: 'Get Picture', value: 'getPicture', action: 'Get the group picture' },
                        { name: 'Get Settings', value: 'getSettings', action: 'Get group settings' },
                        { name: 'Join', value: 'join', action: 'Join a group via invite code' },
                        { name: 'Leave', value: 'leave', action: 'Leave a group' },
                        { name: 'List', value: 'list', action: 'List all groups' },
                        {
                            name: 'Promote Participants',
                            value: 'promoteParticipants',
                            action: 'Promote participants to admin',
                        },
                        {
                            name: 'Reject Membership Requests',
                            value: 'rejectMembershipRequests',
                            action: 'Reject pending join requests',
                        },
                        {
                            name: 'Remove Participants',
                            value: 'removeParticipants',
                            action: 'Remove participants from a group',
                        },
                        {
                            name: 'Revoke Invite Code',
                            value: 'revokeInviteCode',
                            action: 'Revoke the group invite code',
                        },
                        { name: 'Set Picture', value: 'setPicture', action: 'Set the group picture' },
                        {
                            name: 'Update Description',
                            value: 'updateDescription',
                            action: 'Update the group description',
                        },
                        { name: 'Update Settings', value: 'updateSettings', action: 'Update group settings' },
                        { name: 'Update Subject', value: 'updateSubject', action: 'Update the group subject' },
                    ],
                    default: 'list',
                },
                {
                    displayName: 'Session Name or ID',
                    name: 'sessionId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getSessions',
                    },
                    default: '',
                    required: true,
                    displayOptions: {
                        show: { resource: ['group'] },
                    },
                    description: 'The ID of the session. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Group Name or ID',
                    name: 'groupId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getGroups',
                        loadOptionsDependsOn: ['sessionId'],
                    },
                    default: '',
                    required: true,
                    placeholder: '120363021234567890@g.us',
                    displayOptions: {
                        show: {
                            resource: ['group'],
                            operation: [
                                'get',
                                'getInviteCode',
                                'getSettings',
                                'leave',
                                'revokeInviteCode',
                                'addParticipants',
                                'removeParticipants',
                                'promoteParticipants',
                                'demoteParticipants',
                                'updateSubject',
                                'updateDescription',
                                'updateSettings',
                                'getMembershipRequests',
                                'approveMembershipRequests',
                                'rejectMembershipRequests',
                                'getPicture',
                                'setPicture',
                                'deletePicture',
                            ],
                        },
                    },
                    description: 'The group ID (WhatsApp JID, e.g. 120363021234567890@g.us). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Group Name',
                    name: 'groupName',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: {
                        show: { resource: ['group'], operation: ['create'] },
                    },
                    description: 'The subject/name for the new group',
                },
                {
                    displayName: 'Participants',
                    name: 'groupParticipants',
                    type: 'string',
                    default: '',
                    required: true,
                    placeholder: '628123456789@c.us, 628987654321@c.us',
                    displayOptions: {
                        show: {
                            resource: ['group'],
                            operation: [
                                'create',
                                'addParticipants',
                                'removeParticipants',
                                'promoteParticipants',
                                'demoteParticipants',
                            ],
                        },
                    },
                    description: 'WhatsApp IDs of the participants (max 256). Accepts a comma-separated list, a JSON array, or an expression resolving to an array. Add/remove/promote/demote report per-participant outcomes in results[]; check those rather than the top-level success.',
                },
                {
                    displayName: 'Invite Code',
                    name: 'groupInviteCode',
                    type: 'string',
                    default: '',
                    required: true,
                    placeholder: 'XyZ987654321',
                    displayOptions: {
                        show: { resource: ['group'], operation: ['join', 'getJoinInfo'] },
                    },
                    description: 'The group invite code — the part after https://chat.whatsapp.com/. A full invite link is accepted and reduced to the code.',
                },
                {
                    displayName: 'Subject',
                    name: 'groupSubject',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: {
                        show: { resource: ['group'], operation: ['updateSubject'] },
                    },
                    description: 'The new group subject/name',
                },
                {
                    displayName: 'Description',
                    name: 'groupDescription',
                    type: 'string',
                    typeOptions: {
                        rows: 3,
                    },
                    default: '',
                    displayOptions: {
                        show: { resource: ['group'], operation: ['updateDescription'] },
                    },
                    description: 'The new group description. Leave empty to clear the existing description.',
                },
                {
                    displayName: 'Requesters',
                    name: 'groupRequestParticipants',
                    type: 'string',
                    default: '',
                    placeholder: '628123456789@c.us, 628987654321@c.us',
                    displayOptions: {
                        show: {
                            resource: ['group'],
                            operation: ['approveMembershipRequests', 'rejectMembershipRequests'],
                        },
                    },
                    description: 'Which pending requests to act on, at most 256. Accepts a comma-separated list, a JSON array, or an expression resolving to an array. Leave empty to act on every pending request.',
                },
                {
                    displayName: 'Picture Source',
                    name: 'groupPictureSource',
                    type: 'options',
                    options: [
                        { name: 'Binary', value: 'binary' },
                        { name: 'URL', value: 'url' },
                        { name: 'Base64', value: 'base64' },
                    ],
                    default: 'binary',
                    displayOptions: { show: { resource: ['group'], operation: ['setPicture'] } },
                    description: 'Where the picture comes from',
                },
                {
                    displayName: 'Input Binary Field',
                    name: 'groupPictureBinaryProperty',
                    type: 'string',
                    default: 'data',
                    required: true,
                    displayOptions: {
                        show: {
                            resource: ['group'],
                            operation: ['setPicture'],
                            groupPictureSource: ['binary'],
                        },
                    },
                    description: 'The name of the input binary field holding the picture',
                },
                {
                    displayName: 'Picture URL',
                    name: 'groupPictureUrl',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: {
                        show: { resource: ['group'], operation: ['setPicture'], groupPictureSource: ['url'] },
                    },
                    description: 'URL of the picture to set',
                },
                {
                    displayName: 'Base64 Data',
                    name: 'groupPictureBase64',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: {
                        show: { resource: ['group'], operation: ['setPicture'], groupPictureSource: ['base64'] },
                    },
                    description: 'Base64 encoded picture data',
                },
                {
                    displayName: 'MIME Type',
                    name: 'groupPictureMimeType',
                    type: 'string',
                    default: 'image/jpeg',
                    required: true,
                    placeholder: 'image/jpeg',
                    displayOptions: {
                        show: { resource: ['group'], operation: ['setPicture'], groupPictureSource: ['base64'] },
                    },
                    description: 'MIME type of the base64 picture data',
                },
                {
                    displayName: 'Settings',
                    name: 'groupSettings',
                    type: 'collection',
                    placeholder: 'Add Setting',
                    default: {},
                    displayOptions: {
                        show: { resource: ['group'], operation: ['updateSettings'] },
                    },
                    description: 'At least one setting is required; settings you leave out stay untouched',
                    options: [
                        {
                            displayName: 'Announce',
                            name: 'announce',
                            type: 'boolean',
                            default: false,
                            description: 'Whether only admins can send messages to the group',
                        },
                        {
                            displayName: 'Disappearing Messages (Seconds)',
                            name: 'ephemeralSeconds',
                            type: 'number',
                            typeOptions: { minValue: 0 },
                            default: 604800,
                            description: 'Disappearing-message timer in seconds (0 disables it). Baileys engine only — whatsapp-web.js returns 501.',
                        },
                        {
                            displayName: 'Locked',
                            name: 'locked',
                            type: 'boolean',
                            default: false,
                            description: 'Whether only admins can edit the group info',
                        },
                        {
                            displayName: 'Member Add Mode',
                            name: 'memberAddMode',
                            type: 'options',
                            options: [
                                { name: 'All Members', value: 'all' },
                                { name: 'Admins Only', value: 'admins' },
                            ],
                            default: 'all',
                            description: 'Who may add new participants to the group',
                        },
                    ],
                },
                {
                    displayName: 'Options',
                    name: 'groupListOptions',
                    type: 'collection',
                    placeholder: 'Add Option',
                    default: {},
                    displayOptions: {
                        show: { resource: ['group'], operation: ['list'] },
                    },
                    description: 'If left empty, the server applies its own defaults (limit 1000, offset 0)',
                    options: [
                        {
                            displayName: 'Limit',
                            name: 'limit',
                            type: 'number',
                            typeOptions: { minValue: 1, maxValue: 1000 },
                            default: 50,
                            description: 'Max number of results to return',
                        },
                        {
                            displayName: 'Offset',
                            name: 'offset',
                            type: 'number',
                            typeOptions: { minValue: 0 },
                            default: 0,
                            description: 'Number of groups to skip before collecting the result set',
                        },
                    ],
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
                        { name: 'Get', value: 'get', action: 'Get a webhook' },
                        {
                            name: 'Get Delivery Failures',
                            value: 'getDeliveryFailures',
                            action: 'List failed webhook deliveries',
                        },
                        { name: 'List', value: 'list', action: 'List the webhooks of a session' },
                        { name: 'List All', value: 'listAll', action: 'List webhooks across all sessions' },
                        { name: 'Test', value: 'test', action: 'Send a test delivery to a webhook' },
                        { name: 'Update', value: 'update', action: 'Update a webhook' },
                    ],
                    default: 'create',
                },
                {
                    displayName: 'Session Name or ID',
                    name: 'sessionId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getSessions',
                    },
                    default: '',
                    required: true,
                    displayOptions: {
                        show: { resource: ['webhook'] },
                        hide: { operation: ['listAll', 'getDeliveryFailures'] },
                    },
                    description: 'The ID of the session. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    // Two collections rather than one shared between List All and Get
                    // Delivery Failures: GET /api/webhooks binds only limit and offset, so a
                    // session filter offered there would be accepted by the UI and then
                    // silently ignored by the server.
                    displayName: 'Options',
                    name: 'webhookListOptions',
                    type: 'collection',
                    placeholder: 'Add Option',
                    default: {},
                    displayOptions: {
                        show: { resource: ['webhook'], operation: ['listAll'] },
                    },
                    options: [
                        {
                            displayName: 'Limit',
                            name: 'limit',
                            type: 'number',
                            typeOptions: { minValue: 1 },
                            default: 50,
                            description: 'Max number of results to return',
                        },
                        {
                            displayName: 'Offset',
                            name: 'offset',
                            type: 'number',
                            typeOptions: { minValue: 0 },
                            default: 0,
                            description: 'Number of records to skip before collecting the result set',
                        },
                    ],
                },
                {
                    displayName: 'Options',
                    name: 'deliveryFailureOptions',
                    type: 'collection',
                    placeholder: 'Add Option',
                    default: {},
                    displayOptions: {
                        show: { resource: ['webhook'], operation: ['getDeliveryFailures'] },
                    },
                    options: [
                        {
                            displayName: 'Limit',
                            name: 'limit',
                            type: 'number',
                            typeOptions: { minValue: 1 },
                            default: 50,
                            description: 'Max number of results to return',
                        },
                        {
                            displayName: 'Offset',
                            name: 'offset',
                            type: 'number',
                            typeOptions: { minValue: 0 },
                            default: 0,
                            description: 'Number of records to skip before collecting the result set',
                        },
                        {
                            displayName: 'Session Name or ID',
                            name: 'sessionId',
                            type: 'options',
                            typeOptions: {
                                loadOptionsMethod: 'getSessions',
                            },
                            default: '',
                            description: 'Only return delivery failures for this session. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                        },
                    ],
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
                    description: 'The URL to receive webhook events. Credentials in the URL (https://user:pass@host/hook) are refused outright rather than stripped, because they would be persisted with the registration and echoed into delivery logs. When the gateway has SSRF protection on, a URL resolving to a private or loopback address is also refused, with a deliberately generic message that does not say which rule it broke.',
                },
                {
                    displayName: 'Events',
                    name: 'events',
                    type: 'multiOptions',
                    options: webhookEvents_1.WEBHOOK_EVENT_OPTIONS,
                    default: ['message.received'],
                    displayOptions: {
                        show: { resource: ['webhook'], operation: ['create'] },
                    },
                    description: 'Events to subscribe to',
                },
                {
                    displayName: 'Additional Fields',
                    name: 'webhookCreateFields',
                    type: 'collection',
                    placeholder: 'Add Field',
                    default: {},
                    displayOptions: { show: { resource: ['webhook'], operation: ['create'] } },
                    options: [
                        {
                            displayName: 'Filters',
                            name: 'filters',
                            type: 'json',
                            default: '',
                            description: 'Server-side filters as JSON, in the form <code>{"conditions":[{"field":"type","operator":"is","value":["text"]}]}</code>. Conditions are ANDed, at most 20. Fields: <code>sender</code>, <code>recipient</code>, <code>body</code>, <code>type</code>, <code>isGroup</code>, <code>kind</code>, <code>fromMe</code>, <code>hasMedia</code>, <code>mentions</code>. <code>kind</code> (server ≥ 0.23.4) names the chat kind, one of <code>individual</code>, <code>group</code>, <code>channel</code>, <code>status</code>, <code>broadcast</code> or <code>unknown</code>, and is the only way to single out or exclude a Channel post, which <code>isGroup</code> reports as false along with everything else. Value shape is enforced: the ID, mentions, type and kind fields take a non-empty array, <code>body</code> takes a plain string, and the boolean fields take a real boolean. Filters narrow only message events, so session, group and call events are delivered regardless. Within the message family, an <code>is</code> condition on a field a given event does not carry suppresses that event outright: a <code>sender</code> filter alongside a Message Ack subscription drops every ack, because an ack carries no sender. Filter narrowly, or register a second webhook for the other events. A suppressed delivery is silent and looks the same from n8n as nothing having happened.',
                        },
                        {
                            displayName: 'Headers',
                            name: 'headers',
                            type: 'json',
                            default: '',
                            description: 'Extra headers to send with each delivery, as a JSON object. Reserved headers the gateway sets itself cannot be overridden.',
                        },
                        {
                            displayName: 'Retry Count',
                            name: 'retryCount',
                            type: 'number',
                            typeOptions: { minValue: 0, maxValue: 5 },
                            default: 3,
                            description: 'Maximum delivery attempts (0-5)',
                        },
                    ],
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
                    description: 'Optional shared secret, at least 16 characters (the server rejects a shorter one at registration). If set, OpenWA signs each delivery to this webhook with an X-OpenWA-Signature (HMAC-SHA256) header.',
                },
                {
                    displayName: 'Webhook Name or ID',
                    name: 'webhookId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getWebhooks',
                        loadOptionsDependsOn: ['sessionId'],
                    },
                    default: '',
                    required: true,
                    displayOptions: {
                        show: { resource: ['webhook'], operation: ['delete', 'update', 'test', 'get'] },
                    },
                    description: 'The ID of the webhook. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
                            displayName: 'Clear Secret',
                            name: 'clearSecret',
                            type: 'boolean',
                            default: false,
                            description: 'Whether to stop signing deliveries by removing the stored secret. The server spells this as an empty secret, which a blank field cannot express: an n8n collection yields a blank as soon as the field is added, so a blank Secret is ignored rather than read as a request to disable signing. Ignores Secret while it is on.',
                        },
                        {
                            displayName: 'Events',
                            name: 'events',
                            type: 'multiOptions',
                            options: webhookEvents_1.WEBHOOK_EVENT_OPTIONS,
                            default: [],
                            description: 'Replaces the full set of subscribed events (not merged)',
                        },
                        {
                            displayName: 'Filters (JSON)',
                            name: 'filters',
                            type: 'json',
                            default: '',
                            description: 'Advanced delivery filters as a JSON object, e.g. {"conditions":[...]}. Enter null to clear existing filters.',
                        },
                        {
                            displayName: 'Headers (JSON)',
                            name: 'headers',
                            type: 'json',
                            default: '',
                            description: 'Custom delivery headers as a flat JSON object of string values, e.g. {"X-Team":"ops"}. Replaces the stored map wholesale rather than merging into it, so send every header you want kept. Enter null to clear them. The server never returns stored headers, and strips content-type and x-openwa-* names at delivery so a custom header cannot shadow a system one.',
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
                            description: 'HMAC-SHA256 signing secret, at least 16 characters (255 at most). Set a value to rotate it; a blank value is ignored, because a collection yields one as soon as the field is added. Turn on Clear Secret to stop signing instead.',
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
                // ============== CHAT OPERATIONS ==============
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: { show: { resource: ['chat'] } },
                    options: [
                        { name: 'Archive', value: 'archive', action: 'Archive or unarchive a chat' },
                        {
                            name: 'Clear Messages',
                            value: 'clearMessages',
                            action: 'Delete every message in a chat',
                        },
                        { name: 'Delete', value: 'delete', action: 'Delete a chat' },
                        { name: 'List', value: 'list', action: 'List all chats' },
                        { name: 'Mark Read', value: 'markRead', action: 'Mark a chat as read' },
                        { name: 'Mark Unread', value: 'markUnread', action: 'Mark a chat as unread' },
                        { name: 'Mute', value: 'mute', action: 'Mute or unmute a chat' },
                        { name: 'Pin', value: 'pin', action: 'Pin or unpin a chat' },
                        { name: 'Set State', value: 'setState', action: 'Send a typing or recording indicator' },
                    ],
                    default: 'list',
                },
                {
                    displayName: 'Session Name or ID',
                    name: 'sessionId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getSessions',
                    },
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['chat'] } },
                    description: 'The ID of the session. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Chat Name or ID',
                    name: 'chatId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getChats',
                        loadOptionsDependsOn: ['sessionId'],
                    },
                    default: '',
                    required: true,
                    placeholder: '628123456789@c.us',
                    displayOptions: {
                        show: {
                            resource: ['chat'],
                            operation: [
                                'markRead',
                                'markUnread',
                                'delete',
                                'setState',
                                'archive',
                                'pin',
                                'mute',
                                'clearMessages',
                            ],
                        },
                    },
                    description: 'The chat to act on (e.g. 628123456789@c.us, or ...@g.us for a group). Only the first 1000 are listed; use an expression for anything beyond that. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Message IDs',
                    name: 'readMessageIds',
                    type: 'string',
                    default: '',
                    placeholder: '3EB0C767D26B8A3F1A2B, 3EB0C767D26B8A3F1A2C',
                    displayOptions: { show: { resource: ['chat'], operation: ['markRead'] } },
                    description: 'Specific message IDs to acknowledge (max 100). Accepts a comma-separated list, a JSON array, or an expression resolving to an array. Baileys acknowledges individual messages, so without this only the newest message the engine still holds in memory gets a receipt: a burst leaves its earlier messages unread, and a restarted session has nothing to acknowledge at all. Ignored by whatsapp-web.js, whose own read receipt is chat-level.',
                },
                {
                    displayName: 'Archive',
                    name: 'archive',
                    type: 'boolean',
                    default: true,
                    displayOptions: { show: { resource: ['chat'], operation: ['archive'] } },
                    description: 'Whether to archive the chat. Turn off to bring it back to the chat list.',
                },
                {
                    displayName: 'Pin',
                    name: 'pin',
                    type: 'boolean',
                    default: true,
                    displayOptions: { show: { resource: ['chat'], operation: ['pin'] } },
                    description: 'Whether to pin the chat. Turn off to unpin. WhatsApp allows at most three pinned chats and refuses a fourth. On whatsapp-web.js that refusal comes back as a false success flag, so check it. On Baileys the flag is always true and the cap is invisible, so a fourth pin reports success and does not stick.',
                },
                {
                    displayName: 'Mute Until',
                    name: 'muteUntil',
                    type: 'dateTime',
                    default: '',
                    displayOptions: { show: { resource: ['chat'], operation: ['mute'] } },
                    description: 'When the mute expires, sent as epoch milliseconds. Leave empty to unmute now. There is no duration form, so a fixed mute is expressed as a moment in the future, and a date already past is accepted but expires immediately. Chat > List reports a still-muted chat as muteExpiration 0 when the mute is indefinite; 0 is not a value this field accepts, so re-apply an indefinite mute with a far-future moment instead.',
                },
                {
                    displayName: 'State',
                    name: 'chatState',
                    type: 'options',
                    options: [
                        { name: 'Paused', value: 'paused' },
                        { name: 'Recording', value: 'recording' },
                        { name: 'Typing', value: 'typing' },
                    ],
                    default: 'typing',
                    displayOptions: { show: { resource: ['chat'], operation: ['setState'] } },
                    description: 'Typing and Recording show the indicator in the chat; Paused clears it again',
                },
                {
                    displayName: 'Options',
                    name: 'chatListOptions',
                    type: 'collection',
                    placeholder: 'Add Option',
                    default: {},
                    displayOptions: { show: { resource: ['chat'], operation: ['list'] } },
                    options: [
                        {
                            displayName: 'Limit',
                            name: 'limit',
                            type: 'number',
                            typeOptions: { minValue: 1 },
                            default: 50,
                            description: 'Max number of results to return',
                        },
                        {
                            displayName: 'Offset',
                            name: 'offset',
                            type: 'number',
                            typeOptions: { minValue: 0 },
                            default: 0,
                            description: 'Number of chats to skip before collecting the result set',
                        },
                    ],
                },
                // ============== PRESENCE OPERATIONS ==============
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: { show: { resource: ['presence'] } },
                    options: [
                        {
                            name: 'Get',
                            value: 'get',
                            action: 'Get the last reported presence for a chat',
                        },
                        {
                            name: 'Set Own Presence',
                            value: 'setOwn',
                            action: 'Set whether the account appears online',
                        },
                        {
                            name: 'Subscribe',
                            value: 'subscribe',
                            action: 'Subscribe to presence updates for a chat',
                        },
                    ],
                    default: 'subscribe',
                },
                {
                    displayName: 'Session Name or ID',
                    name: 'sessionId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getSessions',
                    },
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['presence'] } },
                    description: 'The ID of the session. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Chat Name or ID',
                    name: 'chatId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getChats',
                        loadOptionsDependsOn: ['sessionId'],
                    },
                    default: '',
                    required: true,
                    placeholder: '628123456789@c.us',
                    displayOptions: {
                        show: { resource: ['presence'], operation: ['subscribe', 'get'] },
                    },
                    description: 'The chat to watch, as a full WhatsApp ID with its domain. Read presence back with the @c.us form: the gateway stores each report under a normalized ID, so subscribing with @s.whatsapp.net and reading with the same string returns nothing. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Available',
                    name: 'presenceAvailable',
                    type: 'boolean',
                    default: true,
                    displayOptions: { show: { resource: ['presence'], operation: ['setOwn'] } },
                    description: "Whether the account announces itself as online. WhatsApp routes notifications away from the phone while a linked device is online, so a workflow-driven session left available suppresses the account holder's own alerts; turn this off to hand them back. There is no read-back: nothing reports what was last published, and the setting resets on every reconnect.",
                },
                {
                    displayName: "Presence is connection-scoped. A subscription and the account's own availability both live on the socket, so a restart, a Stop/Start, or any automatic reconnect ends them and nothing on the server re-issues them. Re-run these from a Trigger branch on <code>session.status</code> reaching <code>ready</code>, not once at workflow start. Subscribe is Baileys only; whatsapp-web.js answers 501 and never reports presence at all.",
                    name: 'presenceScopeNotice',
                    type: 'notice',
                    default: '',
                    displayOptions: { show: { resource: ['presence'] } },
                },
                // ============== PROFILE OPERATIONS ==============
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: { show: { resource: ['profile'] } },
                    options: [
                        {
                            name: 'Delete Picture',
                            value: 'deletePicture',
                            action: 'Remove the profile picture',
                        },
                        { name: 'Set Name', value: 'setName', action: 'Set the profile display name' },
                        { name: 'Set Picture', value: 'setPicture', action: 'Set the profile picture' },
                        { name: 'Set Status', value: 'setStatus', action: 'Set the profile about text' },
                    ],
                    default: 'setName',
                },
                {
                    displayName: 'Session Name or ID',
                    name: 'sessionId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getSessions',
                    },
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['profile'] } },
                    description: 'The ID of the session whose own profile is changed. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Name',
                    name: 'profileName',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['profile'], operation: ['setName'] } },
                    description: 'The new display name. WhatsApp allows at most 25 characters.',
                },
                {
                    displayName: 'Status',
                    name: 'profileStatus',
                    type: 'string',
                    default: '',
                    displayOptions: { show: { resource: ['profile'], operation: ['setStatus'] } },
                    description: 'The new about text (max 139 characters). Leave empty to clear it.',
                },
                {
                    displayName: 'Picture Source',
                    name: 'profilePictureSource',
                    type: 'options',
                    options: [
                        { name: 'Base64', value: 'base64' },
                        { name: 'Binary Data', value: 'binary' },
                        { name: 'URL', value: 'url' },
                    ],
                    default: 'url',
                    displayOptions: { show: { resource: ['profile'], operation: ['setPicture'] } },
                },
                {
                    displayName: 'Binary Property',
                    name: 'profilePictureBinaryProperty',
                    type: 'string',
                    default: 'data',
                    required: true,
                    displayOptions: {
                        show: {
                            resource: ['profile'],
                            operation: ['setPicture'],
                            profilePictureSource: ['binary'],
                        },
                    },
                    description: 'Name of the binary property containing the picture',
                },
                {
                    displayName: 'Picture URL',
                    name: 'profilePictureUrl',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: {
                        show: { resource: ['profile'], operation: ['setPicture'], profilePictureSource: ['url'] },
                    },
                    description: 'URL of the picture to set',
                },
                {
                    displayName: 'Base64 Data',
                    name: 'profilePictureBase64',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: {
                        show: {
                            resource: ['profile'],
                            operation: ['setPicture'],
                            profilePictureSource: ['base64'],
                        },
                    },
                    description: 'Base64 encoded picture data',
                },
                {
                    displayName: 'MIME Type',
                    name: 'profilePictureMimeType',
                    type: 'string',
                    default: 'image/jpeg',
                    required: true,
                    placeholder: 'image/jpeg',
                    displayOptions: {
                        show: {
                            resource: ['profile'],
                            operation: ['setPicture'],
                            profilePictureSource: ['base64'],
                        },
                    },
                    description: 'MIME type of the base64 picture. OpenWA requires this for base64 payloads.',
                },
                // ============== LABEL OPERATIONS ==============
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: { show: { resource: ['label'] } },
                    options: [
                        { name: 'Add to Chat', value: 'addToChat', action: 'Add a label to a chat' },
                        {
                            name: 'Create or Update',
                            value: 'upsert',
                            action: 'Create or update a label',
                        },
                        { name: 'Delete', value: 'delete', action: 'Delete a label' },
                        { name: 'Get', value: 'get', action: 'Get a label' },
                        { name: 'Get Chats', value: 'getChats', action: 'Get every chat carrying a label' },
                        { name: 'Get for Chat', value: 'getForChat', action: 'Get the labels of a chat' },
                        { name: 'List', value: 'list', action: 'List all labels' },
                        {
                            name: 'Remove From Chat',
                            value: 'removeFromChat',
                            action: 'Remove a label from a chat',
                        },
                    ],
                    default: 'list',
                },
                {
                    displayName: 'Session Name or ID',
                    name: 'sessionId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getSessions',
                    },
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['label'] } },
                    description: 'The ID of the session. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Chat Name or ID',
                    name: 'chatId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getChats',
                        loadOptionsDependsOn: ['sessionId'],
                    },
                    default: '',
                    required: true,
                    placeholder: '628123456789@c.us',
                    displayOptions: {
                        show: { resource: ['label'], operation: ['getForChat', 'addToChat', 'removeFromChat'] },
                    },
                    description: 'The chat whose labels are read or changed. Only the first 1000 are listed; use an expression for anything beyond that. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Label Name or ID',
                    name: 'labelId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getLabels',
                        loadOptionsDependsOn: ['sessionId'],
                    },
                    default: '',
                    required: true,
                    displayOptions: {
                        show: {
                            resource: ['label'],
                            operation: ['get', 'getChats', 'addToChat', 'removeFromChat'],
                        },
                    },
                    description: 'The ID of the label. The dropdown is fed by the label listing, which is whatsapp-web.js only, so on Baileys it stays empty even for Add to Chat and Remove From Chat, which do work there. Supply the ID from an expression on that engine. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Label ID',
                    name: 'newLabelId',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['label'], operation: ['upsert', 'delete'] } },
                    description: 'The ID of the label. This is plain text rather than a picker, because the ID is chosen by the caller and the label listing these operations would need is unavailable on the engine that serves them. On Create or Update, reusing an existing ID rewrites that label instead of failing.',
                },
                {
                    displayName: 'Fields',
                    name: 'labelFields',
                    type: 'collection',
                    placeholder: 'Add Field',
                    default: {},
                    required: true,
                    displayOptions: { show: { resource: ['label'], operation: ['upsert'] } },
                    description: 'At least one is required. On an existing label, anything left out keeps its current value.',
                    options: [
                        {
                            displayName: 'Name',
                            name: 'labelName',
                            type: 'string',
                            default: '',
                            description: 'Label text, up to 100 characters',
                        },
                        {
                            displayName: 'Color',
                            name: 'labelColor',
                            type: 'number',
                            typeOptions: { minValue: 0, maxValue: 19 },
                            default: 0,
                            description: "Which of WhatsApp's 20 predefined label colours to use, as an index from 0 to 19. This is not a hex value, and the colour a read returns is a hex string that cannot be converted back, so a read then write cannot preserve it.",
                        },
                    ],
                },
                {
                    displayName: 'Label support splits by engine. Reading labels (List, Get, Get Chats, Get for Chat) works on whatsapp-web.js and answers 501 on Baileys, while editing them (Create or Update, Delete) works on Baileys and answers 501 on whatsapp-web.js. Only Add to Chat and Remove From Chat work on both. On one session you can create a label you cannot then list.',
                    name: 'labelEngineNotice',
                    type: 'notice',
                    default: '',
                    displayOptions: { show: { resource: ['label'] } },
                },
                // ============== STATUS OPERATIONS ==============
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: { show: { resource: ['status'] } },
                    options: [
                        { name: 'Delete', value: 'delete', action: 'Delete a status update' },
                        {
                            name: 'Get by Contact',
                            value: 'getByContact',
                            action: 'Get the statuses of a contact',
                        },
                        { name: 'Get Media', value: 'getMedia', action: 'Get the media of a status update' },
                        { name: 'List', value: 'list', action: 'List the status feed' },
                        { name: 'Send Image', value: 'sendImage', action: 'Post an image status' },
                        { name: 'Send Text', value: 'sendText', action: 'Post a text status' },
                        { name: 'Send Video', value: 'sendVideo', action: 'Post a video status' },
                        {
                            name: 'Send Voice',
                            value: 'sendVoice',
                            action: 'Post an audio status as a voice note',
                        },
                    ],
                    default: 'list',
                },
                {
                    displayName: 'Session Name or ID',
                    name: 'sessionId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getSessions',
                    },
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['status'] } },
                    description: 'The ID of the session. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Contact Name or ID',
                    name: 'statusContactId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getContacts',
                        loadOptionsDependsOn: ['sessionId'],
                    },
                    default: '',
                    required: true,
                    placeholder: '628123456789@c.us',
                    displayOptions: { show: { resource: ['status'], operation: ['getByContact'] } },
                    description: 'The contact whose status updates are returned. Only the first 1000 are listed; use an expression for anything beyond that. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Status ID',
                    name: 'statusId',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['status'], operation: ['getMedia', 'delete'] } },
                    description: 'The ID of the status update',
                },
                {
                    displayName: 'Put Output in Field',
                    name: 'binaryPropertyName',
                    type: 'string',
                    default: 'data',
                    required: true,
                    displayOptions: { show: { resource: ['message', 'status'], operation: ['getMedia'] } },
                    description: 'The name of the output binary field to put the media in',
                },
                {
                    displayName: 'Text',
                    name: 'statusText',
                    type: 'string',
                    typeOptions: { rows: 3 },
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['status'], operation: ['sendText'] } },
                    description: 'The status text to post',
                },
                {
                    displayName: 'Background Color',
                    name: 'statusBackgroundColor',
                    type: 'color',
                    default: '',
                    displayOptions: {
                        show: { resource: ['status'], operation: ['sendText', 'sendVoice'] },
                    },
                    description: 'Background color for the status. Leave empty for the server default. On Send Voice it is Baileys only: whatsapp-web.js posts no styling with a media status and drops it.',
                },
                {
                    displayName: 'Font',
                    name: 'statusFont',
                    type: 'options',
                    options: [
                        { name: 'Bold (6)', value: 6 },
                        { name: 'Default (0)', value: 0 },
                        { name: 'Font 1', value: 1 },
                        { name: 'Font 10', value: 10 },
                        { name: 'Font 2', value: 2 },
                        { name: 'Font 7', value: 7 },
                        { name: 'Font 8', value: 8 },
                        { name: 'Font 9', value: 9 },
                        { name: 'Server Default', value: -1 },
                    ],
                    default: -1,
                    displayOptions: { show: { resource: ['status'], operation: ['sendText'] } },
                    description: 'Font index from the WhatsApp status font set. Indexes 8, 9 and 10 reach Baileys but not whatsapp-web.js, which honors 0 to 7 and falls back to the default above that.',
                },
                {
                    displayName: 'Caption',
                    name: 'statusCaption',
                    type: 'string',
                    default: '',
                    displayOptions: {
                        show: { resource: ['status'], operation: ['sendImage', 'sendVideo'] },
                    },
                    description: 'Optional caption for the status media (max 1024 characters)',
                },
                {
                    displayName: 'Audio Source',
                    name: 'statusVoiceSource',
                    type: 'options',
                    options: [
                        { name: 'Binary', value: 'binary' },
                        { name: 'URL', value: 'url' },
                        { name: 'Base64', value: 'base64' },
                    ],
                    default: 'binary',
                    displayOptions: { show: { resource: ['status'], operation: ['sendVoice'] } },
                    description: 'Where the audio comes from',
                },
                {
                    displayName: 'Input Binary Field',
                    name: 'statusVoiceBinaryProperty',
                    type: 'string',
                    default: 'data',
                    required: true,
                    displayOptions: {
                        show: { resource: ['status'], operation: ['sendVoice'], statusVoiceSource: ['binary'] },
                    },
                    description: 'The name of the input binary field holding the audio',
                },
                {
                    displayName: 'Audio URL',
                    name: 'statusVoiceUrl',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: {
                        show: { resource: ['status'], operation: ['sendVoice'], statusVoiceSource: ['url'] },
                    },
                    description: 'URL of the audio to post',
                },
                {
                    displayName: 'Base64 Data',
                    name: 'statusVoiceBase64',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: {
                        show: { resource: ['status'], operation: ['sendVoice'], statusVoiceSource: ['base64'] },
                    },
                    description: 'Base64 encoded audio data',
                },
                {
                    displayName: 'MIME Type',
                    name: 'statusVoiceMimeType',
                    type: 'string',
                    default: 'audio/ogg; codecs=opus',
                    required: true,
                    placeholder: 'audio/ogg; codecs=opus',
                    displayOptions: {
                        show: { resource: ['status'], operation: ['sendVoice'], statusVoiceSource: ['base64'] },
                    },
                    description: 'MIME type of the base64 audio data',
                },
                {
                    displayName: 'A voice status needs Ogg/Opus audio, and nothing in the pipeline transcodes: other formats post but will not play. Run the file through Media > Convert to Voice Note first and feed its base64 output in here.',
                    name: 'statusVoiceNotice',
                    type: 'notice',
                    default: '',
                    displayOptions: { show: { resource: ['status'], operation: ['sendVoice'] } },
                },
                {
                    displayName: 'Recipients',
                    name: 'statusRecipients',
                    type: 'string',
                    default: '',
                    placeholder: '628123456789@c.us, 628987654321@c.us',
                    displayOptions: {
                        show: {
                            resource: ['status'],
                            operation: ['sendText', 'sendImage', 'sendVideo', 'sendVoice'],
                        },
                    },
                    description: "Who may see this status (max 256, @c.us or @lid, never a group). Accepts a comma-separated list, a JSON array, or an expression resolving to an array. Required on the Baileys engine, which is the only engine that honors it. On whatsapp-web.js the list is ignored and the status goes to that account's usual status audience regardless, so do not rely on it to limit who sees it there.",
                },
                {
                    displayName: 'Image Source',
                    name: 'statusImageSource',
                    type: 'options',
                    options: [
                        { name: 'Base64', value: 'base64' },
                        { name: 'Binary Data', value: 'binary' },
                        { name: 'URL', value: 'url' },
                    ],
                    default: 'url',
                    displayOptions: { show: { resource: ['status'], operation: ['sendImage'] } },
                },
                {
                    displayName: 'Binary Property',
                    name: 'statusImageBinaryProperty',
                    type: 'string',
                    default: 'data',
                    required: true,
                    displayOptions: {
                        show: { resource: ['status'], operation: ['sendImage'], statusImageSource: ['binary'] },
                    },
                    description: 'Name of the binary property containing the image',
                },
                {
                    displayName: 'Image URL',
                    name: 'statusImageUrl',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: {
                        show: { resource: ['status'], operation: ['sendImage'], statusImageSource: ['url'] },
                    },
                    description: 'URL of the image to post',
                },
                {
                    displayName: 'Base64 Data',
                    name: 'statusImageBase64',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: {
                        show: { resource: ['status'], operation: ['sendImage'], statusImageSource: ['base64'] },
                    },
                    description: 'Base64 encoded image data',
                },
                {
                    displayName: 'MIME Type',
                    name: 'statusImageMimeType',
                    type: 'string',
                    default: 'image/jpeg',
                    required: true,
                    placeholder: 'image/jpeg',
                    displayOptions: {
                        show: { resource: ['status'], operation: ['sendImage'], statusImageSource: ['base64'] },
                    },
                    description: 'MIME type of the base64 image. OpenWA requires this for base64 payloads.',
                },
                {
                    displayName: 'Video Source',
                    name: 'statusVideoSource',
                    type: 'options',
                    options: [
                        { name: 'Base64', value: 'base64' },
                        { name: 'Binary Data', value: 'binary' },
                        { name: 'URL', value: 'url' },
                    ],
                    default: 'url',
                    displayOptions: { show: { resource: ['status'], operation: ['sendVideo'] } },
                },
                {
                    displayName: 'Binary Property',
                    name: 'statusVideoBinaryProperty',
                    type: 'string',
                    default: 'data',
                    required: true,
                    displayOptions: {
                        show: { resource: ['status'], operation: ['sendVideo'], statusVideoSource: ['binary'] },
                    },
                    description: 'Name of the binary property containing the video',
                },
                {
                    displayName: 'Video URL',
                    name: 'statusVideoUrl',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: {
                        show: { resource: ['status'], operation: ['sendVideo'], statusVideoSource: ['url'] },
                    },
                    description: 'URL of the video to post',
                },
                {
                    displayName: 'Base64 Data',
                    name: 'statusVideoBase64',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: {
                        show: { resource: ['status'], operation: ['sendVideo'], statusVideoSource: ['base64'] },
                    },
                    description: 'Base64 encoded video data',
                },
                {
                    displayName: 'MIME Type',
                    name: 'statusVideoMimeType',
                    type: 'string',
                    default: 'video/mp4',
                    required: true,
                    placeholder: 'video/mp4',
                    displayOptions: {
                        show: { resource: ['status'], operation: ['sendVideo'], statusVideoSource: ['base64'] },
                    },
                    description: 'MIME type of the base64 video. OpenWA requires this for base64 payloads.',
                },
                // ============== TEMPLATE OPERATIONS ==============
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: { show: { resource: ['template'] } },
                    options: [
                        { name: 'Create', value: 'create', action: 'Create a template' },
                        { name: 'Delete', value: 'delete', action: 'Delete a template' },
                        { name: 'Get', value: 'get', action: 'Get a template' },
                        { name: 'List', value: 'list', action: 'List all templates' },
                        { name: 'Update', value: 'update', action: 'Update a template' },
                    ],
                    default: 'list',
                },
                {
                    displayName: 'Session Name or ID',
                    name: 'sessionId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getSessions',
                    },
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['template'] } },
                    description: 'The ID of the session. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Template Name or ID',
                    name: 'templateId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getTemplates',
                        loadOptionsDependsOn: ['sessionId'],
                    },
                    default: '',
                    required: true,
                    displayOptions: {
                        show: { resource: ['template'], operation: ['get', 'update', 'delete'] },
                    },
                    description: 'The ID of the template. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Name',
                    name: 'templateName',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['template'], operation: ['create'] } },
                    description: 'Unique template name within the session (max 100 characters)',
                },
                {
                    displayName: 'Body',
                    name: 'templateBody',
                    type: 'string',
                    typeOptions: { rows: 4 },
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['template'], operation: ['create'] } },
                    description: 'Template body with {{variable}} placeholders, filled in by Message → Send Template',
                },
                {
                    displayName: 'Header',
                    name: 'templateHeader',
                    type: 'string',
                    default: '',
                    displayOptions: { show: { resource: ['template'], operation: ['create'] } },
                    description: 'Optional header text, prepended to the rendered body',
                },
                {
                    displayName: 'Footer',
                    name: 'templateFooter',
                    type: 'string',
                    default: '',
                    displayOptions: { show: { resource: ['template'], operation: ['create'] } },
                    description: 'Optional footer text, appended to the rendered body',
                },
                {
                    displayName: 'Update Fields',
                    name: 'templateUpdateFields',
                    type: 'collection',
                    placeholder: 'Add Field',
                    default: {},
                    displayOptions: { show: { resource: ['template'], operation: ['update'] } },
                    description: 'Only the fields you set are changed; everything else keeps its current value',
                    options: [
                        {
                            displayName: 'Body',
                            name: 'body',
                            type: 'string',
                            typeOptions: { rows: 4 },
                            default: '',
                            description: 'Template body with {{variable}} placeholders',
                        },
                        {
                            displayName: 'Footer',
                            name: 'footer',
                            type: 'string',
                            default: '',
                            description: 'Footer text appended to the rendered body',
                        },
                        {
                            displayName: 'Header',
                            name: 'header',
                            type: 'string',
                            default: '',
                            description: 'Header text prepended to the rendered body',
                        },
                        {
                            displayName: 'Name',
                            name: 'name',
                            type: 'string',
                            default: '',
                            description: 'Template name',
                        },
                    ],
                },
                // ============== CATALOG OPERATIONS ==============
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: { show: { resource: ['catalog'] } },
                    options: [
                        { name: 'Get', value: 'get', action: 'Get the business catalog' },
                        { name: 'Get Product', value: 'getProduct', action: 'Get one catalog product' },
                        { name: 'List Products', value: 'listProducts', action: 'List catalog products' },
                    ],
                    default: 'listProducts',
                },
                {
                    displayName: 'Session Name or ID',
                    name: 'sessionId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getSessions',
                    },
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['catalog'] } },
                    description: 'The ID of the session. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Product ID',
                    name: 'productId',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['catalog'], operation: ['getProduct'] } },
                    description: 'The ID of the product, as returned by List Products',
                },
                {
                    displayName: 'Options',
                    name: 'catalogListOptions',
                    type: 'collection',
                    placeholder: 'Add Option',
                    default: {},
                    displayOptions: { show: { resource: ['catalog'], operation: ['listProducts'] } },
                    options: [
                        {
                            displayName: 'Limit',
                            name: 'limit',
                            type: 'number',
                            typeOptions: { minValue: 1 },
                            default: 50,
                            description: 'Max number of results to return',
                        },
                        {
                            displayName: 'Page',
                            name: 'page',
                            type: 'number',
                            typeOptions: { minValue: 1 },
                            default: 1,
                            description: 'Which page of products to return',
                        },
                    ],
                },
                {
                    displayName: 'The catalog is Baileys only: whatsapp-web.js answers 501 on every operation here. Use List Products to find the product ID that Message > Send Product needs. A 503 can mean WhatsApp left the catalog query unanswered, which it does permanently for some business accounts, so treat a repeated 503 as that account being unsupported rather than as a transient worth retrying.',
                    name: 'catalogEngineNotice',
                    type: 'notice',
                    default: '',
                    displayOptions: { show: { resource: ['catalog'] } },
                },
                // ============== CHANNEL OPERATIONS ==============
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: { show: { resource: ['channel'] } },
                    options: [
                        { name: 'Create', value: 'create', action: 'Create a channel' },
                        {
                            name: 'Delete',
                            value: 'delete',
                            action: 'Permanently delete a channel this account owns',
                        },
                        {
                            name: 'Demote Admin',
                            value: 'demoteAdmin',
                            action: 'Demote a channel admin back to a subscriber',
                        },
                        { name: 'Get', value: 'get', action: 'Get a channel' },
                        { name: 'Get Messages', value: 'getMessages', action: 'Get the messages of a channel' },
                        { name: 'List', value: 'list', action: 'List followed channels' },
                        { name: 'Mute', value: 'mute', action: 'Mute or unmute a channel' },
                        { name: 'Subscribe', value: 'subscribe', action: 'Follow a channel by invite code' },
                        {
                            name: 'Transfer Ownership',
                            value: 'transferOwnership',
                            action: 'Transfer channel ownership to another account',
                        },
                        { name: 'Unsubscribe', value: 'unsubscribe', action: 'Unfollow a channel' },
                    ],
                    default: 'list',
                },
                {
                    displayName: 'Session Name or ID',
                    name: 'sessionId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getSessions',
                    },
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['channel'] } },
                    description: 'The ID of the session. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Channel Name or ID',
                    name: 'channelId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getChannels',
                        loadOptionsDependsOn: ['sessionId'],
                    },
                    default: '',
                    required: true,
                    displayOptions: {
                        show: {
                            resource: ['channel'],
                            operation: [
                                'get',
                                'unsubscribe',
                                'getMessages',
                                'delete',
                                'mute',
                                'demoteAdmin',
                                'transferOwnership',
                            ],
                        },
                    },
                    description: 'The ID of the channel, in the form 1234567890@newsletter. The list is populated by the channel listing, which only whatsapp-web.js supports: on Baileys it stays empty and the ID has to be supplied from an expression. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Channel Name',
                    name: 'channelName',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['channel'], operation: ['create'] } },
                    description: 'Name for the new channel, up to 100 characters',
                },
                {
                    displayName: 'Description',
                    name: 'channelDescription',
                    type: 'string',
                    typeOptions: { rows: 3 },
                    default: '',
                    displayOptions: { show: { resource: ['channel'], operation: ['create'] } },
                    description: 'Optional description for the new channel, up to 2048 characters',
                },
                {
                    displayName: 'Mute',
                    name: 'channelMute',
                    type: 'boolean',
                    default: true,
                    displayOptions: { show: { resource: ['channel'], operation: ['mute'] } },
                    description: 'Whether to mute the channel. Turn off to unmute.',
                },
                {
                    displayName: 'User ID',
                    name: 'channelUserId',
                    type: 'string',
                    default: '',
                    required: true,
                    placeholder: '628123456789@c.us',
                    displayOptions: { show: { resource: ['channel'], operation: ['demoteAdmin'] } },
                    description: 'The admin to demote back to a subscriber. A bare phone number is accepted and qualified by the server.',
                },
                {
                    displayName: 'New Owner ID',
                    name: 'channelNewOwnerId',
                    type: 'string',
                    default: '',
                    required: true,
                    placeholder: '628123456789@c.us',
                    displayOptions: { show: { resource: ['channel'], operation: ['transferOwnership'] } },
                    description: 'The account to hand the channel to. A bare phone number is accepted and qualified by the server.',
                },
                {
                    displayName: 'Delete destroys the channel for every subscriber and cannot be undone, and only its owner can do it. Unsubscribe merely unfollows it for this account. Reversing that means subscribing again, which only Baileys can do: whatsapp-web.js unsubscribes but answers 501 on Subscribe, so there it is one-way.',
                    name: 'channelDeleteNotice',
                    type: 'notice',
                    default: '',
                    displayOptions: { show: { resource: ['channel'], operation: ['delete'] } },
                },
                {
                    displayName: 'Invite Code',
                    name: 'channelInviteCode',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['channel'], operation: ['subscribe'] } },
                    description: 'The channel invite code — the part after https://whatsapp.com/channel/. A full link is accepted and reduced to the code.',
                },
                {
                    displayName: 'Options',
                    name: 'channelListOptions',
                    type: 'collection',
                    placeholder: 'Add Option',
                    default: {},
                    displayOptions: { show: { resource: ['channel'], operation: ['getMessages'] } },
                    options: [
                        {
                            displayName: 'Limit',
                            name: 'limit',
                            type: 'number',
                            typeOptions: { minValue: 1, maxValue: 100 },
                            default: 50,
                            description: 'Max number of results to return',
                        },
                    ],
                },
                {
                    displayName: 'Channel support splits by engine. List and Get Messages work on whatsapp-web.js and answer 501 on Baileys, while Subscribe, Demote Admin and Transfer Ownership work on Baileys and answer 501 on whatsapp-web.js. Create, Get, Mute, Unsubscribe and Delete work on both.',
                    name: 'channelEngineNotice',
                    type: 'notice',
                    default: '',
                    displayOptions: { show: { resource: ['channel'] } },
                },
                // ============== AUTOMATION RULE OPERATIONS ==============
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: { show: { resource: ['automationRule'] } },
                    options: [
                        { name: 'Create', value: 'create', action: 'Create an autoreply rule' },
                        { name: 'Delete', value: 'delete', action: 'Delete an autoreply rule' },
                        { name: 'Get', value: 'get', action: 'Get an autoreply rule' },
                        { name: 'List', value: 'list', action: 'List the autoreply rules of a session' },
                        { name: 'Update', value: 'update', action: 'Update an autoreply rule' },
                    ],
                    default: 'list',
                },
                {
                    displayName: 'Session Name or ID',
                    name: 'sessionId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getSessions',
                    },
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['automationRule'] } },
                    description: 'The ID of the session. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Rule ID',
                    name: 'ruleId',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: {
                        show: { resource: ['automationRule'], operation: ['get', 'update', 'delete'] },
                    },
                    description: 'The ID of the rule, as returned by Create or List',
                },
                {
                    displayName: 'Name',
                    name: 'ruleName',
                    type: 'string',
                    default: '',
                    required: true,
                    placeholder: 'Greet new enquiries',
                    displayOptions: { show: { resource: ['automationRule'], operation: ['create'] } },
                    description: 'Display name for the rule, up to 100 characters',
                },
                {
                    displayName: 'Reply Text',
                    name: 'ruleReplyText',
                    type: 'string',
                    typeOptions: { rows: 3 },
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['automationRule'], operation: ['create'] } },
                    description: 'What the gateway sends back when the rule matches, up to 4096 characters',
                },
                {
                    displayName: 'Conditions',
                    name: 'ruleConditions',
                    type: 'json',
                    default: '',
                    displayOptions: { show: { resource: ['automationRule'], operation: ['create'] } },
                    description: 'Which messages the rule answers, as JSON in the same shape as webhook filters: <code>{"conditions":[{"field":"isGroup","operator":"is","value":false}]}</code>. All conditions must match. Leave empty and the rule answers every inbound message.',
                },
                {
                    displayName: 'Additional Fields',
                    name: 'ruleFields',
                    type: 'collection',
                    placeholder: 'Add Field',
                    default: {},
                    displayOptions: { show: { resource: ['automationRule'], operation: ['create'] } },
                    options: [
                        {
                            displayName: 'Cooldown (Seconds)',
                            name: 'cooldownSeconds',
                            type: 'number',
                            typeOptions: { minValue: 0, maxValue: 86400 },
                            default: 60,
                            description: 'How long the rule stays quiet in a chat after replying there. This is what stops two auto-repliers answering each other forever, so set 0 only deliberately.',
                        },
                        {
                            displayName: 'Enabled',
                            name: 'enabled',
                            type: 'boolean',
                            default: true,
                            description: 'Whether the rule is active',
                        },
                    ],
                },
                {
                    displayName: 'Update Fields',
                    name: 'ruleUpdateFields',
                    type: 'collection',
                    placeholder: 'Add Field',
                    default: {},
                    displayOptions: { show: { resource: ['automationRule'], operation: ['update'] } },
                    description: 'Only the fields you add are sent. Anything left out keeps its stored value.',
                    options: [
                        {
                            displayName: 'Conditions',
                            name: 'conditions',
                            type: 'json',
                            default: '',
                            description: 'Match conditions as JSON, in the same shape as webhook filters. Leaving this blank keeps the rule\'s stored conditions unchanged, because an update only sends the fields you fill in. To make the rule answer everything again, send {"conditions":[]}; an empty object on its own is refused.',
                        },
                        {
                            displayName: 'Cooldown (Seconds)',
                            name: 'cooldownSeconds',
                            type: 'number',
                            typeOptions: { minValue: 0, maxValue: 86400 },
                            default: 60,
                            description: 'How long the rule stays quiet in a chat after replying there',
                        },
                        {
                            displayName: 'Enabled',
                            name: 'enabled',
                            type: 'boolean',
                            default: true,
                            description: 'Whether the rule is active',
                        },
                        {
                            displayName: 'Name',
                            name: 'name',
                            type: 'string',
                            default: '',
                            description: 'Display name for the rule, up to 100 characters',
                        },
                        {
                            displayName: 'Reply Text',
                            name: 'replyText',
                            type: 'string',
                            typeOptions: { rows: 3 },
                            default: '',
                            description: 'What the gateway sends back when the rule matches',
                        },
                    ],
                },
                {
                    displayName: 'These rules run on the gateway, not in n8n: a matching message is answered even when this workflow is not running. That makes them the right tool for an out-of-hours acknowledgement, and the wrong one for anything needing workflow logic. Conditions use the same field set as webhook filters and therefore only see message events.',
                    name: 'automationRuleNotice',
                    type: 'notice',
                    default: '',
                    displayOptions: { show: { resource: ['automationRule'] } },
                },
                // ============== CALL OPERATIONS ==============
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: { show: { resource: ['call'] } },
                    options: [
                        {
                            name: 'Create Link',
                            value: 'createLink',
                            action: 'Create a shareable call link',
                        },
                        { name: 'Reject', value: 'reject', action: 'Reject an incoming call' },
                    ],
                    default: 'reject',
                },
                {
                    displayName: 'Session Name or ID',
                    name: 'sessionId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getSessions',
                    },
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['call'] } },
                    description: 'The ID of the session. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Call ID',
                    name: 'callId',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['call'], operation: ['reject'] } },
                    description: "The ID of the call, as delivered by the Trigger's call events",
                },
                {
                    displayName: 'Call Type',
                    name: 'callLinkType',
                    type: 'options',
                    options: [
                        { name: 'Video', value: 'video' },
                        { name: 'Audio', value: 'audio' },
                    ],
                    default: 'video',
                    displayOptions: { show: { resource: ['call'], operation: ['createLink'] } },
                    description: 'Whether the link opens a video or an audio call',
                },
                {
                    displayName: 'Start Time',
                    name: 'callLinkStartTime',
                    type: 'dateTime',
                    default: '',
                    displayOptions: { show: { resource: ['call'], operation: ['createLink'] } },
                    description: 'When the call is due to start. Leave empty for now. The response carries only the link, with no expiry, so the node cannot report how long it stays valid.',
                },
                // ============== OBSERVABILITY OPERATIONS ==============
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: { show: { resource: ['observability'] } },
                    options: [
                        { name: 'Check', value: 'check', action: 'Check server health' },
                        {
                            name: 'Check Liveness',
                            value: 'checkLiveness',
                            action: 'Check the liveness probe',
                        },
                        {
                            name: 'Check Readiness',
                            value: 'checkReadiness',
                            action: 'Check the readiness probe',
                        },
                    ],
                    default: 'check',
                },
                // ============== SYSTEM OPERATIONS ==============
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: { show: { resource: ['system'] } },
                    options: [
                        { name: 'Get Audit Log', value: 'getAudit', action: 'Get the audit log' },
                        {
                            name: 'Get Message Stats',
                            value: 'getStatsMessages',
                            action: 'Get message statistics',
                        },
                        {
                            name: 'Get Session Stats',
                            value: 'getSessionStats',
                            action: 'Get statistics for one session',
                        },
                        { name: 'Get Settings', value: 'getSettings', action: 'Get the server settings' },
                        {
                            name: 'Get Stats Overview',
                            value: 'getStatsOverview',
                            action: 'Get an overview of the statistics',
                        },
                        { name: 'Search', value: 'search', action: 'Search messages across sessions' },
                    ],
                    default: 'getSettings',
                },
                {
                    displayName: 'Session Name or ID',
                    name: 'sessionId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getSessions',
                    },
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['system'], operation: ['getSessionStats'] } },
                    description: 'The session to report statistics for. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Query',
                    name: 'searchQuery',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['system'], operation: ['search'] } },
                    description: 'The text to search for',
                },
                {
                    displayName: 'Filters',
                    name: 'searchFilters',
                    type: 'collection',
                    placeholder: 'Add Filter',
                    default: {},
                    displayOptions: { show: { resource: ['system'], operation: ['search'] } },
                    options: [
                        {
                            // Deliberately free text, not a dropdown: Search spans every session,
                            // so the Session ID here is only a filter and there is no single
                            // session whose chats could be listed.
                            displayName: 'Chat ID',
                            name: 'chatId',
                            type: 'string',
                            default: '',
                            description: 'Only search within this chat',
                        },
                        {
                            displayName: 'Date From',
                            name: 'dateFrom',
                            type: 'dateTime',
                            default: '',
                            description: 'Only return messages at or after this moment',
                        },
                        {
                            displayName: 'Date To',
                            name: 'dateTo',
                            type: 'dateTime',
                            default: '',
                            description: 'Only return messages at or before this moment',
                        },
                        {
                            displayName: 'Direction',
                            name: 'direction',
                            type: 'options',
                            options: [
                                { name: 'Incoming', value: 'incoming' },
                                { name: 'Outgoing', value: 'outgoing' },
                            ],
                            default: 'incoming',
                            description: 'Only return messages in this direction',
                        },
                        {
                            displayName: 'From',
                            name: 'from',
                            type: 'string',
                            default: '',
                            description: 'Only return messages from this sender',
                        },
                        {
                            displayName: 'Limit',
                            name: 'limit',
                            type: 'number',
                            typeOptions: { minValue: 1 },
                            default: 50,
                            description: 'Max number of results to return',
                        },
                        {
                            displayName: 'Offset',
                            name: 'offset',
                            type: 'number',
                            typeOptions: { minValue: 0 },
                            default: 0,
                            description: 'Number of results to skip before collecting the result set',
                        },
                        {
                            displayName: 'Session Name or ID',
                            name: 'sessionId',
                            type: 'options',
                            typeOptions: {
                                loadOptionsMethod: 'getSessions',
                            },
                            default: '',
                            description: 'Only search within this session. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                        },
                        {
                            displayName: 'Type',
                            name: 'type',
                            type: 'string',
                            default: '',
                            description: 'Only return messages of this type (e.g. text, image)',
                        },
                    ],
                },
                {
                    displayName: 'Period',
                    name: 'statsPeriod',
                    type: 'options',
                    options: [
                        { name: 'Last 24 Hours', value: '24h' },
                        { name: 'Last 7 Days', value: '7d' },
                        { name: 'Last 30 Days', value: '30d' },
                    ],
                    default: '24h',
                    displayOptions: { show: { resource: ['system'], operation: ['getStatsMessages'] } },
                    description: 'The window to report on. The bucket size follows from it: hourly for 24 hours, daily for the longer windows.',
                },
                {
                    displayName: 'Filters',
                    name: 'auditFilters',
                    type: 'collection',
                    placeholder: 'Add Filter',
                    default: {},
                    displayOptions: { show: { resource: ['system'], operation: ['getAudit'] } },
                    options: [
                        {
                            displayName: 'Action',
                            name: 'action',
                            type: 'string',
                            default: '',
                            placeholder: 'session_started',
                            description: 'Only return entries for this action, e.g. session_started or message_failed. An action the server does not recognise returns an empty page rather than an error, so a typo looks exactly like no matching activity.',
                        },
                        {
                            displayName: 'API Key Name or ID',
                            name: 'keyId',
                            type: 'options',
                            typeOptions: {
                                loadOptionsMethod: 'getApiKeys',
                            },
                            default: '',
                            description: 'Only return entries recorded for this API key. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                        },
                        {
                            displayName: 'Limit',
                            name: 'limit',
                            type: 'number',
                            typeOptions: { minValue: 1, maxValue: 200 },
                            default: 50,
                            description: 'Max number of results to return',
                        },
                        {
                            displayName: 'Offset',
                            name: 'offset',
                            type: 'number',
                            typeOptions: { minValue: 0 },
                            default: 0,
                            description: 'Number of entries to skip before collecting the result set',
                        },
                        {
                            displayName: 'Session Name or ID',
                            name: 'sessionId',
                            type: 'options',
                            typeOptions: {
                                loadOptionsMethod: 'getSessions',
                            },
                            default: '',
                            description: 'Only return entries for this session. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                        },
                        {
                            displayName: 'Severity',
                            name: 'severity',
                            type: 'options',
                            options: [
                                { name: 'Error', value: 'error' },
                                { name: 'Info', value: 'info' },
                                { name: 'Warn', value: 'warn' },
                            ],
                            default: 'info',
                            description: 'Only return entries at this severity',
                        },
                    ],
                },
                // ============== API KEY OPERATIONS ==============
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: { show: { resource: ['apiKey'] } },
                    options: [
                        { name: 'Create', value: 'create', action: 'Create an API key' },
                        { name: 'Delete', value: 'delete', action: 'Delete an API key' },
                        { name: 'Get', value: 'get', action: 'Get an API key' },
                        { name: 'List', value: 'list', action: 'List all API keys' },
                        { name: 'Revoke', value: 'revoke', action: 'Revoke an API key' },
                        { name: 'Update', value: 'update', action: 'Update an API key' },
                        { name: 'Validate', value: 'validate', action: 'Validate the credential in use' },
                    ],
                    default: 'list',
                },
                {
                    displayName: 'API Key Name or ID',
                    name: 'keyId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getApiKeys',
                    },
                    default: '',
                    required: true,
                    displayOptions: {
                        show: { resource: ['apiKey'], operation: ['get', 'update', 'delete', 'revoke'] },
                    },
                    description: 'The ID of the API key (not the key itself). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Name',
                    name: 'keyName',
                    type: 'string',
                    default: '',
                    required: true,
                    displayOptions: { show: { resource: ['apiKey'], operation: ['create'] } },
                    description: 'A friendly name for the new key',
                },
                {
                    displayName: 'Fields',
                    name: 'keyFields',
                    type: 'collection',
                    placeholder: 'Add Field',
                    default: {},
                    displayOptions: { show: { resource: ['apiKey'], operation: ['create', 'update'] } },
                    description: 'Optional restrictions. On Update, only the fields you set are changed; an empty list never clears an existing whitelist.',
                    options: [
                        {
                            displayName: 'Allowed IPs',
                            name: 'allowedIps',
                            type: 'string',
                            default: '',
                            placeholder: '10.0.0.1, 10.0.0.2',
                            description: 'Restrict the key to these IP addresses. Accepts a comma-separated list, a JSON array, or an expression resolving to an array.',
                        },
                        {
                            displayName: 'Allowed Sessions',
                            name: 'allowedSessions',
                            type: 'string',
                            default: '',
                            placeholder: '3f2b1c40-9a7e-4d21-8b55-0c1e2f3a4b5c',
                            description: 'Restrict the key to these session IDs. These are the session UUIDs, not the session names shown in the picker: a name never matches and silently restricts the key to nothing. Accepts a comma-separated list, a JSON array, or an expression resolving to an array.',
                        },
                        {
                            displayName: 'Expires At',
                            name: 'expiresAt',
                            type: 'dateTime',
                            default: '',
                            description: 'When the key stops working',
                        },
                        {
                            displayName: 'Name',
                            name: 'name',
                            type: 'string',
                            default: '',
                            description: 'A friendly name for the key',
                        },
                        {
                            displayName: 'Role',
                            name: 'role',
                            type: 'options',
                            options: [
                                { name: 'Admin', value: 'admin' },
                                { name: 'Operator', value: 'operator' },
                                { name: 'Viewer', value: 'viewer' },
                            ],
                            default: 'viewer',
                            description: 'Permission level granted to the key',
                        },
                    ],
                },
            ],
            usableAsTool: true,
        };
        // Dropdowns for the ID fields that have a listing endpoint behind them. The
        // stored value stays a plain string, so supplying an ID from an expression
        // keeps working. Messages have no loader — there is no bounded list to offer.
        this.methods = {
            loadOptions: loadOptions,
        };
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        const resource = this.getNodeParameter('resource', 0);
        const operation = this.getNodeParameter('operation', 0);
        const credentials = await this.getCredentials('openWaApi');
        const baseUrl = credentials.serverUrl.replace(/\/$/, '');
        for (let i = 0; i < items.length; i++) {
            try {
                const builder = RESOURCE_BUILDERS[resource];
                const spec = builder ? await builder.call(this, operation, i) : null;
                if (!spec) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Unsupported resource/operation: ${resource}/${operation}`, { itemIndex: i });
                }
                // Make request
                const isText = spec.responseFormat === 'text';
                const isBinary = spec.responseFormat === 'binary';
                const options = {
                    method: spec.method,
                    url: `${baseUrl}${spec.endpoint}`,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    // A route that answers with text or raw bytes must not be parsed as JSON.
                    json: !isText && !isBinary,
                };
                if (isBinary) {
                    options.encoding = 'arraybuffer';
                }
                if (spec.method !== 'GET' && Object.keys(spec.body).length > 0) {
                    options.body = spec.body;
                }
                if (spec.qs && Object.keys(spec.qs).length > 0) {
                    options.qs = spec.qs;
                }
                let response;
                try {
                    response = await this.helpers.httpRequestWithAuthentication.call(this, 'openWaApi', options);
                }
                catch (requestError) {
                    // Classified here, the one place a failure is known to have come off the
                    // wire. Everything else in this block is the node's own validation, and
                    // calling that a NodeApiError blames the gateway for a bad parameter.
                    const decoded = isBinary ? decodeBinaryErrorBody(requestError) : requestError;
                    // A rejection with no shape at all takes NodeApiError down when it reads
                    // `.message` off it, and that TypeError then replaces the failure with a
                    // sentence about a null dereference. Rare, but it lands on the two paths a
                    // user has least ability to diagnose: a thrown error and a kept-going item.
                    const apiError = new n8n_workflow_1.NodeApiError(this.getNode(), (decoded ?? {
                        message: 'The request failed without returning a response',
                    }));
                    // n8n has usually wrapped the failure already, and NodeApiError hands an
                    // existing one straight back without reading its options, so the item index
                    // is assigned to the result to survive both shapes. Without it a failed run
                    // names no item, which is all the user has to go on with many of them.
                    apiError.context.itemIndex = i;
                    throw apiError;
                }
                if (isBinary) {
                    // Raw bytes belong on the item's binary property; putting them on
                    // `json` would hand downstream nodes something they cannot read.
                    const media = response;
                    if (!Buffer.isBuffer(media) && !(media instanceof ArrayBuffer)) {
                        // Without this the Buffer.from below throws a bare TypeError that
                        // says nothing about which operation or item produced it.
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Expected media bytes from the server but received a non-binary body', { itemIndex: i });
                    }
                    const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i, 'data');
                    // No mimeType argument on purpose. The media routes serve everything
                    // outside a small image/video/audio allowlist as `application/octet-stream`
                    // (the gateway's inertMimetype, so the endpoint cannot host active content),
                    // and handing prepareBinaryData that placeholder suppresses the byte
                    // sniffing that recovers application/pdf and its file extension.
                    const binaryData = await this.helpers.prepareBinaryData(Buffer.isBuffer(media) ? media : Buffer.from(media));
                    returnData.push({
                        json: {},
                        binary: { [binaryPropertyName]: binaryData },
                        pairedItem: { item: i },
                    });
                    continue;
                }
                let json;
                if (isText) {
                    // A bare string is not a valid item `json`, so wrap the body rather
                    // than casting it and handing downstream nodes something unreadable.
                    json = { data: typeof response === 'string' ? response : String(response ?? '') };
                }
                else if (response === '' || response === undefined || response === null) {
                    // An empty body reaches here from two places. A successful DELETE answers
                    // 204 No Content, where `{ success: true }` is the useful result. A route
                    // that answers 200 with a null payload (Presence > Get before anything has
                    // been reported) means "nothing yet", and must NOT be dressed up as success.
                    // Either way a bare '' is not valid item json, so downstream nodes would
                    // otherwise receive an unreadable item.
                    json = spec.method === 'DELETE' ? { success: true } : {};
                }
                else if (Array.isArray(response)) {
                    // n8n's convention is one item per row. Left whole, a list route's array
                    // lands on a single item's `json`, where `$json.<field>` is undefined and
                    // Split Out has no field to point at. Contacts > List Blocked answers a
                    // bare `string[]`, and a string is not valid item json, so a non-object
                    // row is wrapped under `data` the same way the text branch wraps its body.
                    for (const row of response) {
                        returnData.push({
                            json: typeof row === 'object' && row !== null && !Array.isArray(row)
                                ? row
                                : { data: row },
                            pairedItem: { item: i },
                        });
                    }
                    continue;
                }
                else {
                    json = response;
                }
                returnData.push({ json, pairedItem: { item: i } });
            }
            catch (error) {
                if (this.continueOnFail()) {
                    // The request failure arrives already classified from the inner catch, and
                    // its description carries the server's explanation of WHY (the 404 on Get
                    // Media covers five different situations). Reading only `message` here
                    // threw that away on exactly the path built to keep going past it.
                    // Nothing in here may throw: this is the branch the user turned on so a
                    // bad item cannot stop the run. Both wrappers dereference their argument,
                    // so a `null`/`undefined` rejection would take the whole execution down
                    // on the one path built to survive it.
                    let message;
                    let description;
                    try {
                        const wrapped = error instanceof n8n_workflow_1.NodeApiError
                            ? error
                            : new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex: i });
                        message = wrapped.message;
                        const detail = explanationText(wrapped.description);
                        description = detail && detail !== wrapped.message ? detail : undefined;
                    }
                    catch {
                        message = String(error?.message ?? error);
                    }
                    returnData.push({
                        json: description === undefined ? { error: message } : { error: message, description },
                        pairedItem: { item: i },
                    });
                    continue;
                }
                // Only what the request produced is an API error, and it arrives already
                // wrapped from the catch above. Everything else is this node's own
                // validation, including the bare Errors sanitizePathParam throws, which as
                // NodeApiErrors read as gateway faults. NodeOperationError returns an
                // existing one untouched, so a handler keeps the item index it set.
                throw error instanceof n8n_workflow_1.NodeApiError
                    ? error
                    : new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex: i });
            }
        }
        return [returnData];
    }
}
exports.OpenWa = OpenWa;
