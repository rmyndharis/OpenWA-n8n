"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWebhookRequest = buildWebhookRequest;
const n8n_workflow_1 = require("n8n-workflow");
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
async function buildWebhookRequest(operation, itemIndex) {
    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
    if (operation === 'create') {
        const events = this.getNodeParameter('events', itemIndex);
        if (!events || events.length === 0) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'At least one event must be selected', {
                itemIndex,
            });
        }
        const body = {
            url: this.getNodeParameter('webhookUrl', itemIndex),
            events,
        };
        const webhookSecret = this.getNodeParameter('webhookSecret', itemIndex, '');
        if (webhookSecret) {
            body.secret = webhookSecret;
        }
        return { endpoint: `/api/sessions/${sessionId}/webhooks`, method: 'POST', body };
    }
    if (operation === 'delete') {
        const webhookId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('webhookId', itemIndex), 'Webhook ID');
        return {
            endpoint: `/api/sessions/${sessionId}/webhooks/${webhookId}`,
            method: 'DELETE',
            body: {},
        };
    }
    if (operation === 'update') {
        const webhookId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('webhookId', itemIndex), 'Webhook ID');
        const body = {};
        const updateFields = this.getNodeParameter('updateFields', itemIndex, {});
        // Only forward the fields the user set — the server treats the PUT as a partial
        // update, so unspecified fields keep their current value.
        for (const key of ['url', 'events', 'active', 'retryCount']) {
            if (updateFields[key] !== undefined) {
                body[key] = updateFields[key];
            }
        }
        // A secret is only forwarded when set to a non-empty value. An empty string would
        // CLEAR the signing secret server-side, so we never leak the field's empty default
        // when it is merely added to the collection. To disable signing, recreate the
        // webhook without a secret.
        if (typeof updateFields.secret === 'string' && updateFields.secret.trim() !== '') {
            body.secret = updateFields.secret;
        }
        // Mirror the create-webhook guard so an empty Events selection fails with a clear
        // message here instead of a raw server 400 (the DTO requires at least one event).
        if (Array.isArray(body.events) && body.events.length === 0) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'At least one event must be selected when updating events', { itemIndex });
        }
        // Headers are non-nullable server-side (clear them by sending {}); filters are
        // nullable and can only be cleared by sending null (the validator rejects {}).
        for (const key of ['headers', 'filters']) {
            const raw = updateFields[key];
            if (raw === undefined)
                continue; // field not added — nothing to send
            if (key === 'filters' && (raw === null || raw === 'null')) {
                body.filters = null; // explicit null clears existing filters
                continue;
            }
            if (raw === null || raw === '')
                continue; // blank value — nothing to send
            try {
                body[key] = typeof raw === 'string' ? JSON.parse(raw) : raw;
            }
            catch {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `${key === 'headers' ? 'Headers' : 'Filters'} must be valid JSON`, { itemIndex });
            }
        }
        return {
            endpoint: `/api/sessions/${sessionId}/webhooks/${webhookId}`,
            method: 'PUT',
            body,
        };
    }
    if (operation === 'test') {
        const webhookId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('webhookId', itemIndex), 'Webhook ID');
        return {
            endpoint: `/api/sessions/${sessionId}/webhooks/${webhookId}/test`,
            method: 'POST',
            body: {},
        };
    }
    return null;
}
//# sourceMappingURL=webhook.js.map