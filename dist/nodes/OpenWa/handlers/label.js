"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLabelRequest = buildLabelRequest;
const n8n_workflow_1 = require("n8n-workflow");
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
const params_1 = require("./params");
/**
 * WhatsApp Business labels — the catalogue of labels on the account, and the
 * labels attached to an individual chat.
 */
async function buildLabelRequest(operation, itemIndex) {
    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
    const base = `/api/sessions/${sessionId}/labels`;
    if (operation === 'list') {
        return { endpoint: base, method: 'GET', body: {} };
    }
    if (operation === 'get' || operation === 'getChats') {
        const labelId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('labelId', itemIndex), 'Label ID');
        return {
            endpoint: operation === 'get' ? `${base}/${labelId}` : `${base}/${labelId}/chats`,
            method: 'GET',
            body: {},
        };
    }
    if (operation === 'upsert' || operation === 'delete') {
        // The id is caller-chosen rather than server-assigned, so this takes a plain
        // text field: the picker can only ever offer labels that already exist, which
        // would leave creation reachable only through an expression.
        const labelId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('newLabelId', itemIndex), 'Label ID');
        if (operation === 'delete') {
            return { endpoint: `${base}/${labelId}`, method: 'DELETE', body: {} };
        }
        const fields = this.getNodeParameter('labelFields', itemIndex, {});
        const body = {};
        const name = (fields.labelName ?? '').trim();
        if (name) {
            body.name = name;
        }
        // 0 is a real colour, so this tests for presence rather than truthiness. The
        // field lives in a collection precisely so "not set" stays distinguishable.
        if (fields.labelColor !== undefined) {
            body.color = fields.labelColor;
        }
        if (Object.keys(body).length === 0) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'At least one of Name or Color must be provided', { itemIndex });
        }
        return { endpoint: `${base}/${labelId}`, method: 'PUT', body };
    }
    // The remaining operations are all scoped to one chat.
    const chatId = encodeURIComponent((0, params_1.requireJid)(this, 'chatId', 'Chat ID', itemIndex));
    switch (operation) {
        case 'getForChat':
            return { endpoint: `${base}/chat/${chatId}`, method: 'GET', body: {} };
        case 'addToChat': {
            const labelId = (0, params_1.requireText)(this, 'labelId', 'Label ID', itemIndex);
            return { endpoint: `${base}/chat/${chatId}`, method: 'POST', body: { labelId } };
        }
        case 'removeFromChat': {
            const labelId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('labelId', itemIndex), 'Label ID');
            return { endpoint: `${base}/chat/${chatId}/${labelId}`, method: 'DELETE', body: {} };
        }
        default:
            return null;
    }
}
//# sourceMappingURL=label.js.map