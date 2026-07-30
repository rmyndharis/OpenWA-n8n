"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLabelRequest = buildLabelRequest;
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
    if (operation === 'get') {
        const labelId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('labelId', itemIndex), 'Label ID');
        return { endpoint: `${base}/${labelId}`, method: 'GET', body: {} };
    }
    // The remaining operations are all scoped to one chat.
    const chatId = encodeURIComponent((0, params_1.requireJid)(this, 'chatId', 'Chat ID', itemIndex));
    switch (operation) {
        case 'getForChat':
            return { endpoint: `${base}/chat/${chatId}`, method: 'GET', body: {} };
        case 'addToChat': {
            const labelId = this.getNodeParameter('labelId', itemIndex).trim();
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