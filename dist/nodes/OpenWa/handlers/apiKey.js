"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApiKeyRequest = buildApiKeyRequest;
const n8n_workflow_1 = require("n8n-workflow");
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
const params_1 = require("./params");
/**
 * API-key administration.
 *
 * The credential used to call these must itself be an admin key. Create returns
 * the new key's plaintext exactly once — capture it in the same execution,
 * because it cannot be read back afterwards.
 */
async function buildApiKeyRequest(operation, itemIndex) {
    const base = '/api/auth/api-keys';
    if (operation === 'validate') {
        // Validates the credential this node is already authenticating with.
        return { endpoint: '/api/auth/validate', method: 'POST', body: {} };
    }
    if (operation === 'list') {
        return { endpoint: base, method: 'GET', body: {} };
    }
    if (operation === 'create') {
        const body = {
            name: (0, params_1.requireText)(this, 'keyName', 'API key name', itemIndex),
        };
        Object.assign(body, collectApiKeyFields.call(this, this.getNodeParameter('keyFields', itemIndex, {}), itemIndex));
        return { endpoint: base, method: 'POST', body };
    }
    const apiKeyId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('keyId', itemIndex), 'API key ID');
    switch (operation) {
        case 'get':
            return { endpoint: `${base}/${apiKeyId}`, method: 'GET', body: {} };
        case 'delete':
            return { endpoint: `${base}/${apiKeyId}`, method: 'DELETE', body: {} };
        case 'revoke':
            return { endpoint: `${base}/${apiKeyId}/revoke`, method: 'POST', body: {} };
        case 'update': {
            const body = collectApiKeyFields.call(this, this.getNodeParameter('keyFields', itemIndex, {}), itemIndex);
            if (Object.keys(body).length === 0) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'At least one field must be provided to update', { itemIndex });
            }
            return { endpoint: `${base}/${apiKeyId}`, method: 'PUT', body };
        }
        default:
            return null;
    }
}
/**
 * Maps the shared optional-fields collection onto the DTO. The two list fields
 * arrive as n8n `multipleValues` strings and are normalised here; an empty list
 * is dropped rather than sent, so it never silently clears a whitelist.
 */
function collectApiKeyFields(fields, itemIndex) {
    const body = {};
    const name = (0, params_1.asText)(fields.name);
    if (name) {
        body.name = name;
    }
    const role = (0, params_1.asText)(fields.role);
    if (role) {
        body.role = role;
    }
    // The DTO takes an ISO-8601 string, but a dateTime field driven by an expression
    // resolves to whatever that expression returned, which is routinely a Date or
    // epoch-ms. Requiring a string dropped both without a word, creating a key that
    // never expires when one with an expiry was asked for.
    if (fields.expiresAt !== undefined && fields.expiresAt !== null && fields.expiresAt !== '') {
        const expiresAt = (0, params_1.toEpochMs)(this, fields.expiresAt, 'Expiry date', itemIndex);
        // A century is the ceiling because it is the smallest bound that still catches
        // the mistake this guard exists for. An epoch in MICROseconds is only ~1.79e15,
        // inside the +/-8.64e15 that Date itself accepts, so bounding on Date alone let
        // it through to a year-58648 expiry and an opaque gateway rejection.
        if (!(expiresAt < Date.now() + 100 * 365 * 24 * 60 * 60 * 1000)) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Expiry date is not a valid date', {
                itemIndex,
            });
        }
        // An instant already past would create a key that is dead on arrival while the
        // request answers 200: the server takes any ISO date here and does not check.
        // Seconds-scale input is the way to arrive here by accident, since it resolves
        // to 1970. Revoke is the operation for retiring a key that already exists.
        if (expiresAt <= Date.now()) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Expiry date must be in the future. Epoch values are milliseconds, not seconds.', { itemIndex });
        }
        body.expiresAt = new Date(expiresAt).toISOString();
    }
    const allowedIps = (0, params_1.toStringList)(fields.allowedIps);
    if (allowedIps.length > 0) {
        body.allowedIps = allowedIps;
    }
    const allowedSessions = (0, params_1.toStringList)(fields.allowedSessions);
    if (allowedSessions.length > 0) {
        body.allowedSessions = allowedSessions;
    }
    return body;
}
