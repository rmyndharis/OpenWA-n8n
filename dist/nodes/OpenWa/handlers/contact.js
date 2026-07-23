"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildContactRequest = buildContactRequest;
const n8n_workflow_1 = require("n8n-workflow");
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
async function buildContactRequest(operation, itemIndex) {
    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
    if (operation === 'checkExists') {
        const phoneNumber = this.getNodeParameter('phoneNumber', itemIndex)
            .trim()
            .replace(/[\s+\-()]/g, '');
        if (!phoneNumber || !/^\d+$/.test(phoneNumber)) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Phone number must contain only digits (no +, spaces, or special characters)', { itemIndex });
        }
        return {
            endpoint: `/api/sessions/${sessionId}/contacts/check/${encodeURIComponent(phoneNumber)}`,
            method: 'GET',
            body: {},
        };
    }
    if (operation === 'getInfo' ||
        operation === 'block' ||
        operation === 'unblock' ||
        operation === 'getProfilePicture' ||
        operation === 'getPhone') {
        const contactId = this.getNodeParameter('contactId', itemIndex).trim();
        if (!contactId) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Contact ID cannot be empty', {
                itemIndex,
            });
        }
        const encoded = encodeURIComponent(contactId);
        switch (operation) {
            case 'getInfo':
                return { endpoint: `/api/sessions/${sessionId}/contacts/${encoded}`, method: 'GET', body: {} };
            case 'block':
                return {
                    endpoint: `/api/sessions/${sessionId}/contacts/${encoded}/block`,
                    method: 'POST',
                    body: {},
                };
            case 'unblock':
                return {
                    endpoint: `/api/sessions/${sessionId}/contacts/${encoded}/block`,
                    method: 'DELETE',
                    body: {},
                };
            case 'getProfilePicture':
                return {
                    endpoint: `/api/sessions/${sessionId}/contacts/${encoded}/profile-picture`,
                    method: 'GET',
                    body: {},
                };
            default:
                return {
                    endpoint: `/api/sessions/${sessionId}/contacts/${encoded}/phone`,
                    method: 'GET',
                    body: {},
                };
        }
    }
    return null;
}
//# sourceMappingURL=contact.js.map