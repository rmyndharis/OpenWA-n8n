"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPresenceRequest = buildPresenceRequest;
const n8n_workflow_1 = require("n8n-workflow");
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
const params_1 = require("./params");
/**
 * Presence: who is online, typing, or last seen.
 *
 * Every operation here is connection-scoped. A subscription lives on the socket,
 * so a restart, a Stop/Start, or any automatic reconnect ends it, and nothing on
 * the server re-issues it. The same is true of the account's own presence. Drive
 * both from the Trigger's `session.status` event reaching `ready` rather than once
 * at workflow start.
 */
async function buildPresenceRequest(operation, itemIndex) {
    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
    const base = `/api/sessions/${sessionId}/presence`;
    switch (operation) {
        case 'subscribe': {
            const chatId = (0, params_1.requireJid)(this, 'chatId', 'Chat ID', itemIndex);
            // SubscribePresenceDto requires a domain-qualified id, unlike the sibling
            // presence routes: Get takes its chat in the path and Set Own Presence takes
            // none at all. Checking here means the message can name the field, rather than
            // arriving as a server 400 whose detail is stripped in production. The example
            // is fixed rather than built from the rejected value, which is not a valid id.
            if (!/^[^\s@]+@[^\s@]+$/.test(chatId)) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Chat ID must be a full WhatsApp ID including its domain, such as 628123456789@c.us, not a bare number', { itemIndex });
            }
            return { endpoint: `${base}/subscribe`, method: 'POST', body: { chatId } };
        }
        case 'get': {
            const chatId = (0, params_1.requireJid)(this, 'chatId', 'Chat ID', itemIndex);
            return {
                endpoint: `${base}/${encodeURIComponent(chatId)}`,
                method: 'GET',
                body: {},
            };
        }
        case 'setOwn': {
            const available = this.getNodeParameter('presenceAvailable', itemIndex, true);
            // PUT on the bare path, not POST on a suffix: easy to copy wrong from Subscribe.
            return { endpoint: base, method: 'PUT', body: { available } };
        }
        default:
            return null;
    }
}
//# sourceMappingURL=presence.js.map