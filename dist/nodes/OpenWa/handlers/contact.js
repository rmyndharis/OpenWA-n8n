"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildContactRequest = buildContactRequest;
const n8n_workflow_1 = require("n8n-workflow");
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
const params_1 = require("./params");
// The bulk profile-picture route documents "max 50 used" — beyond that the
// server drops ids without reporting it.
const MAX_PROFILE_PICTURE_IDS = 50;
async function buildContactRequest(operation, itemIndex) {
    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
    if (operation === 'list') {
        const options = this.getNodeParameter('contactListOptions', itemIndex, {});
        return {
            endpoint: `/api/sessions/${sessionId}/contacts`,
            method: 'GET',
            body: {},
            qs: (0, params_1.toQueryParams)(options),
        };
    }
    if (operation === 'getProfilePictures') {
        // Bulk variant of getProfilePicture: the ids ride in a required query
        // parameter, so an empty list would fetch nothing and 400.
        const ids = (0, params_1.toStringList)(this.getNodeParameter('contactIds', itemIndex, ''));
        if (ids.length === 0) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'At least one contact ID is required', {
                itemIndex,
            });
        }
        // The server silently uses only the first 50; refuse rather than drop the rest.
        if (ids.length > MAX_PROFILE_PICTURE_IDS) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Contact IDs cannot exceed ${MAX_PROFILE_PICTURE_IDS} entries (got ${ids.length}) — the server ignores the rest`, { itemIndex });
        }
        return {
            endpoint: `/api/sessions/${sessionId}/contacts/profile-pictures`,
            method: 'GET',
            body: {},
            qs: { ids: ids.join(',') },
        };
    }
    if (operation === 'checkExists') {
        const phoneNumber = (0, params_1.asText)(this.getNodeParameter('phoneNumber', itemIndex)).replace(/[\s+\-()]/g, '');
        if (!phoneNumber || !/^\d+$/.test(phoneNumber)) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Phone number must be digits in international format. Spaces, +, hyphens and parentheses are stripped first; any other character is rejected.', { itemIndex });
        }
        return {
            endpoint: `/api/sessions/${sessionId}/contacts/check/${encodeURIComponent(phoneNumber)}`,
            method: 'GET',
            body: {},
        };
    }
    if (operation === 'listBlocked') {
        return {
            endpoint: `/api/sessions/${sessionId}/contacts/blocked`,
            method: 'GET',
            body: {},
        };
    }
    if (operation === 'getInfo' ||
        operation === 'block' ||
        operation === 'unblock' ||
        operation === 'getProfilePicture' ||
        operation === 'getPhone' ||
        operation === 'save' ||
        operation === 'delete') {
        const contactId = (0, params_1.asText)(this.getNodeParameter('contactId', itemIndex));
        if (!contactId) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Contact ID cannot be empty', {
                itemIndex,
            });
        }
        const encoded = encodeURIComponent(contactId);
        switch (operation) {
            case 'getInfo':
                return {
                    endpoint: `/api/sessions/${sessionId}/contacts/${encoded}`,
                    method: 'GET',
                    body: {},
                };
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
            case 'save': {
                // A save overwrites the whole entry, so a blank last name is a genuine
                // clear rather than "leave it alone". The key is still omitted when blank:
                // an explicit null reaches the engine and is written as one.
                const body = {
                    firstName: (0, params_1.requireText)(this, 'contactFirstName', 'First Name', itemIndex, 100),
                };
                const lastName = (0, params_1.asText)(this.getNodeParameter('contactLastName', itemIndex, ''));
                if (lastName) {
                    body.lastName = lastName;
                }
                return {
                    endpoint: `/api/sessions/${sessionId}/contacts/${encoded}`,
                    method: 'PUT',
                    body,
                };
            }
            case 'delete':
                return {
                    endpoint: `/api/sessions/${sessionId}/contacts/${encoded}`,
                    method: 'DELETE',
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
