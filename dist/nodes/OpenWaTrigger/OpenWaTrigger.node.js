"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenWaTrigger = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const verifySignature_1 = require("./verifySignature");
const httpStatus_1 = require("./httpStatus");
const configHash_1 = require("./configHash");
const sanitizePathParam_1 = require("../shared/sanitizePathParam");
const jsonParam_1 = require("../shared/jsonParam");
const webhookSecret_1 = require("../shared/webhookSecret");
const webhookEvents_1 = require("../shared/webhookEvents");
const loadOptions_1 = require("../OpenWa/loadOptions");
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
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
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
                    // n8n already makes the delivery URL unique per node instance: it prefixes
                    // this path with the node's webhookId, or with workflow ID + node name when
                    // the instance has none (NodeHelpers.getNodeWebhookUrl). The session is in
                    // the path only so a registration is recognisable in the gateway's webhook
                    // list. A change here changes the delivery URL; checkExists detects that via
                    // the config hash and re-registers the webhook on the next activation.
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
                    description: 'The ID of the session to receive events from. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Events',
                    name: 'events',
                    type: 'multiOptions',
                    options: webhookEvents_1.WEBHOOK_EVENT_OPTIONS,
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
                    description: 'Optional shared secret, at least 16 characters (the server rejects a shorter one at registration). If set, it is registered with OpenWA at webhook creation and every delivery is verified against its X-OpenWA-Signature (HMAC-SHA256) header; deliveries that fail verification are dropped. Changing or clearing the secret (or changing the events or session) re-registers the webhook automatically on the next activation.',
                },
                {
                    displayName: 'Filters',
                    name: 'filters',
                    type: 'json',
                    default: '',
                    description: 'Optional server-side filters as JSON, in the form <code>{"conditions":[{"field":"type","operator":"is","value":["text"]}]}</code>. The gateway drops non-matching events before delivering, so they never start a workflow execution. Conditions are ANDed, at most 20. Fields: <code>sender</code>, <code>recipient</code>, <code>body</code>, <code>type</code>, <code>isGroup</code>, <code>kind</code>, <code>fromMe</code>, <code>hasMedia</code>, <code>mentions</code>. <code>kind</code> (server ≥ 0.23.4) names the chat kind, one of <code>individual</code>, <code>group</code>, <code>channel</code>, <code>status</code>, <code>broadcast</code> or <code>unknown</code>, and is the only way to single out or exclude a Channel post, which <code>isGroup</code> reports as false along with everything else. Filters narrow only message events: session, group and call events arrive regardless. Within the message family, an <code>is</code> condition on a field a given event does not carry suppresses that event outright, so a <code>sender</code> filter combined with a Message Ack subscription drops every ack. Prefer one Trigger with a narrow filter over several Triggers on the same session: each Trigger registers its own webhook, every matching event is delivered to all of them, and the gateway caps registrations per session (16 by default). A filtered-out delivery is silent, so an over-strict filter looks exactly like nothing having happened. Changing this re-registers the webhook on the next activation.',
                },
                {
                    displayName: 'Deduplicate Deliveries',
                    name: 'deduplicateDeliveries',
                    type: 'boolean',
                    default: false,
                    description: "Whether to drop a repeated delivery of the same event, keyed on the envelope's idempotencyKey. OpenWA guarantees at-least-once delivery: it retries a failed POST and replays any delivery stranded by a gateway crash, both under the same idempotencyKey, either of which can otherwise run this workflow twice. Best-effort: static data is saved per execution, so two deliveries arriving at the same moment can both pass.",
                },
                {
                    displayName: 'Each event arrives as an envelope: <code>event</code>, <code>timestamp</code>, <code>sessionId</code>, <code>idempotencyKey</code>, <code>deliveryId</code>, and the event payload under <code>data</code>. Read message fields from <code>data</code> (e.g. <code>{{ $json.data }}</code>). To de-duplicate downstream, key on <code>idempotencyKey</code>, which identifies the event and is reused across retries and crash replays; <code>deliveryId</code> identifies a single attempt and changes on every replay. Some payloads carry extra fields under <code>data</code>, e.g. <code>type: "masked"</code> for a withheld business message and <code>revokedId</code> on a <code>message.revoked</code> event.',
                    name: 'outputShapeNotice',
                    type: 'notice',
                    default: '',
                },
            ],
        };
        // Shares the action node's session loader, so both nodes offer the same list
        // from the same credential rather than drifting apart.
        this.methods = {
            loadOptions: { getSessions: loadOptions_1.getSessions },
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
                    const webhookUrl = this.getNodeWebhookUrl('default') ?? '';
                    const events = this.getNodeParameter('events');
                    // Drop the stored registration from the server and forget it locally, so the
                    // caller can report absent and let n8n create a fresh one.
                    const discardRegistration = async () => {
                        // Delete from the STORED session: the current parameter may already
                        // point at a different session than the one the webhook lives on. That
                        // value was sanitized before it was stored, so encoding it a second time
                        // would corrupt any ID percent-encoding actually touches.
                        const staleSessionId = webhookData.sessionId || sessionId;
                        try {
                            await this.helpers.httpRequestWithAuthentication.call(this, 'openWaApi', {
                                method: 'DELETE',
                                url: `${baseUrl}/api/sessions/${staleSessionId}/webhooks/${encodeURIComponent(webhookData.webhookId)}`,
                                json: true,
                            });
                        }
                        catch (error) {
                            // Already gone remotely is fine. Anything else must fail loud and let
                            // n8n's activation retry complete the cleanup: silently proceeding
                            // would orphan the old registration, which would keep delivering.
                            if ((0, httpStatus_1.httpStatusFromError)(error) !== 404) {
                                throw new n8n_workflow_1.NodeApiError(this.getNode(), error);
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
                    const currentHash = (0, configHash_1.webhookConfigHash)({
                        url: webhookUrl,
                        events,
                        secret: this.getNodeParameter('webhookSecret', ''),
                        sessionId,
                        filters: this.getNodeParameter('filters', ''),
                    });
                    if (webhookData.configHash !== currentHash) {
                        return discardRegistration();
                    }
                    let registration;
                    try {
                        registration = (await this.helpers.httpRequestWithAuthentication.call(this, 'openWaApi', {
                            method: 'GET',
                            url: `${baseUrl}/api/sessions/${sessionId}/webhooks/${encodeURIComponent(webhookData.webhookId)}`,
                            json: true,
                        }));
                    }
                    catch (error) {
                        // A 404 means the webhook is genuinely gone, so report absent and let n8n
                        // recreate it. Any other error is inconclusive: rethrow so activation
                        // fails loudly and n8n's retry restores it, instead of registering a
                        // duplicate webhook (the server does not de-duplicate by URL).
                        if ((0, httpStatus_1.httpStatusFromError)(error) === 404) {
                            return false;
                        }
                        throw new n8n_workflow_1.NodeApiError(this.getNode(), error);
                    }
                    // The registration exists, but existing is not the same as delivering. The
                    // server dispatches only to webhooks matching `active: true`, and both the
                    // URL and the event list can be edited out from under this node (from the
                    // dashboard, the API, or the action node's own Webhook Update). Any of those
                    // leaves the trigger reporting healthy while nothing ever reaches it, so
                    // treat a drifted registration exactly like a stale one and rebuild it.
                    // The secret is the one registered field deliberately not compared: the
                    // server never serializes it back, so there is nothing to compare against,
                    // and the config hash already catches a local change to it. `filters` IS
                    // serialized, and a filter attached out of band suppresses deliveries with
                    // no other trace, so it is compared here. The comparison ignores key order,
                    // because the server round-trips filters through a JSON column and a
                    // reordered but identical filter must not force a re-registration.
                    const sameEvents = (a, b) => {
                        if (!Array.isArray(a) || a.length !== b.length) {
                            return false;
                        }
                        const left = [...a].sort();
                        const right = [...b].sort();
                        return left.every((value, index) => value === right[index]);
                    };
                    let wantedFilters;
                    try {
                        wantedFilters = (0, jsonParam_1.parseJsonParam)(this.getNodeParameter('filters', ''));
                    }
                    catch {
                        // Unreachable today: the config hash above fingerprints malformed filter
                        // text verbatim, so a typo never matches the stored hash and is discarded
                        // before this point. Kept as a guard; create() is what reports the typo.
                        wantedFilters = undefined;
                    }
                    const sameFilters = (0, jsonParam_1.stableStringify)(registration.filters ?? null) === (0, jsonParam_1.stableStringify)(wantedFilters ?? null);
                    if (registration.active === false ||
                        (typeof registration.url === 'string' && registration.url !== webhookUrl) ||
                        !sameEvents(registration.events, events) ||
                        !sameFilters) {
                        return discardRegistration();
                    }
                    return true;
                },
                async create() {
                    const webhookUrl = this.getNodeWebhookUrl('default');
                    const credentials = await this.getCredentials('openWaApi');
                    const baseUrl = credentials.serverUrl.replace(/\/$/, '');
                    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId'), 'Session ID');
                    const events = this.getNodeParameter('events');
                    const webhookSecret = this.getNodeParameter('webhookSecret', '');
                    if (!events || events.length === 0) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'At least one event must be selected');
                    }
                    // A short secret is rejected by the server's registration floor; failing
                    // here names the field instead of surfacing a raw 400 mid-activation.
                    const secretProblem = (0, webhookSecret_1.webhookSecretProblem)(webhookSecret);
                    if (secretProblem) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), secretProblem);
                    }
                    const body = {
                        url: webhookUrl,
                        events,
                    };
                    // Register the shared secret so OpenWA signs each delivery (HMAC-SHA256).
                    if (webhookSecret) {
                        body.secret = webhookSecret;
                    }
                    // Server-side filters, so a non-matching event is dropped at the gateway
                    // instead of waking a workflow that would only discard it. The field is
                    // `type: 'json'`, so an expression-driven value arrives already resolved as
                    // an object rather than as text; both shapes are accepted.
                    let parsedFilters;
                    try {
                        parsedFilters = (0, jsonParam_1.parseJsonParam)(this.getNodeParameter('filters', ''));
                    }
                    catch {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Filters must be valid JSON');
                    }
                    if (parsedFilters !== undefined) {
                        body.filters = parsedFilters;
                    }
                    const response = await this.helpers.httpRequestWithAuthentication.call(this, 'openWaApi', {
                        method: 'POST',
                        url: `${baseUrl}/api/sessions/${sessionId}/webhooks`,
                        body,
                        json: true,
                    });
                    const webhookId = response.id;
                    if (!webhookId) {
                        throw new n8n_workflow_1.NodeApiError(this.getNode(), {
                            message: 'Webhook created but no ID returned in response',
                        });
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
                        filters: this.getNodeParameter('filters', ''),
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
                    // Delete from the session the webhook was registered on: the parameter may
                    // have been edited without re-activating since then. The stored value is
                    // already sanitized; only the fallback, for registrations that predate
                    // session tracking, still needs sanitizing.
                    const sessionId = webhookData.sessionId ||
                        (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId'), 'Session ID');
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
                            throw new n8n_workflow_1.NodeApiError(this.getNode(), error);
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
                // No `workflowData` at all: n8n skips the run only when the field is absent.
                // An empty `[[]]` is still a run, so every refused delivery would create an
                // execution record, and anyone who learned the delivery URL could mint them.
                return { noWebhookResponse: true };
            }
            const signatureHeader = req.headers['x-openwa-signature'];
            const signature = typeof signatureHeader === 'string' ? signatureHeader : undefined;
            if (!(0, verifySignature_1.verifyOpenWaSignature)(req.rawBody, webhookSecret, signature)) {
                // Reject with 401 so OpenWA sees the delivery was refused. IWebhookResponseData
                // has no status field, so set it on the response and suppress n8n's own response.
                this.getResponseObject().status(401).send('Unauthorized');
                return { noWebhookResponse: true };
            }
        }
        const body = req.body;
        // Validate payload is an object
        if (!body || typeof body !== 'object') {
            return {};
        }
        // Optional de-duplication, keyed on `idempotencyKey`: that value identifies the
        // EVENT and is reused verbatim when the gateway replays a delivery stranded by a
        // crash. `deliveryId` identifies one attempt and is re-minted on every replay, so
        // keying on it catches an in-process retry but misses exactly the redelivery this
        // option exists to absorb. `deliveryId` remains the fallback for older gateways
        // whose envelope carries no idempotency key.
        // Best-effort: static data is saved per execution, so two deliveries arriving at
        // the same moment can both pass.
        if (this.getNodeParameter('deduplicateDeliveries', false)) {
            const envelope = body;
            // A Webhook > Test delivery is exempt. Its idempotency key is derived from the
            // webhook id alone, so every test of the same webhook carries an identical
            // key; de-duplicating it would silently drop every test after the first, and a
            // manual probe is precisely the thing that must always run.
            if (envelope.event === 'test') {
                return { workflowData: [this.helpers.returnJsonArray(body)] };
            }
            const rawKey = typeof envelope.idempotencyKey === 'string' && envelope.idempotencyKey
                ? envelope.idempotencyKey
                : envelope.deliveryId;
            if (typeof rawKey === 'string' && rawKey) {
                const staticData = this.getWorkflowStaticData('node');
                // Key name kept from when the ring held delivery ids, so an upgrade does not
                // strand the previous array in the workflow's stored static data.
                const seen = staticData.recentDeliveryIds ?? [];
                if (seen.includes(rawKey)) {
                    this.logger.debug(`OpenWA Trigger: dropping duplicate delivery ${rawKey}`);
                    // Dropping means not running. Returning an empty item set instead would
                    // still register an execution for every replay this option exists to absorb.
                    return {};
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
exports.OpenWaTrigger = OpenWaTrigger;
