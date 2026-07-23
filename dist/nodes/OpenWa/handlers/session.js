"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSessionRequest = buildSessionRequest;
const n8n_workflow_1 = require("n8n-workflow");
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
async function buildSessionRequest(operation, itemIndex) {
    if (operation === 'create') {
        const body = {};
        const sessionName = this.getNodeParameter('sessionName', itemIndex).trim();
        if (!sessionName) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Session name cannot be empty', {
                itemIndex,
            });
        }
        body.name = sessionName;
        const rawConfig = this.getNodeParameter('sessionConfig', itemIndex, '');
        if (rawConfig !== '' && rawConfig !== undefined && rawConfig !== null) {
            let parsedConfig;
            try {
                parsedConfig = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig;
            }
            catch {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Session config must be valid JSON', {
                    itemIndex,
                });
            }
            if (typeof parsedConfig !== 'object' ||
                parsedConfig === null ||
                Array.isArray(parsedConfig)) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Session config must be a JSON object (e.g. {"autoReconnect":true})', { itemIndex });
            }
            body.config = parsedConfig;
        }
        return { endpoint: '/api/sessions', method: 'POST', body };
    }
    if (operation === 'listAll') {
        return { endpoint: '/api/sessions', method: 'GET', body: {} };
    }
    // start, stop, forceKill, delete, getQr, getStatus, and requestPairingCode all
    // address a single session by its UUID id.
    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
    switch (operation) {
        case 'getStatus':
            return { endpoint: `/api/sessions/${sessionId}`, method: 'GET', body: {} };
        case 'start':
            return { endpoint: `/api/sessions/${sessionId}/start`, method: 'POST', body: {} };
        case 'stop':
            return { endpoint: `/api/sessions/${sessionId}/stop`, method: 'POST', body: {} };
        case 'forceKill':
            return { endpoint: `/api/sessions/${sessionId}/force-kill`, method: 'POST', body: {} };
        case 'delete':
            return { endpoint: `/api/sessions/${sessionId}`, method: 'DELETE', body: {} };
        case 'getQr':
            return { endpoint: `/api/sessions/${sessionId}/qr`, method: 'GET', body: {} };
        case 'requestPairingCode': {
            const phoneNumber = this.getNodeParameter('pairingPhoneNumber', itemIndex)
                .trim()
                .replace(/[\s+\-()]/g, '');
            if (!/^\d{6,15}$/.test(phoneNumber)) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Phone number must be 6–15 digits in international format (e.g. 628123456789)', { itemIndex });
            }
            return {
                endpoint: `/api/sessions/${sessionId}/pairing-code`,
                method: 'POST',
                body: { phoneNumber },
            };
        }
        default:
            return null;
    }
}
//# sourceMappingURL=session.js.map