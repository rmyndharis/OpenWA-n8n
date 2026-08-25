"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCallRequest = buildCallRequest;
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
/**
 * Incoming calls. Rejection is the operation offered here; pair it with the
 * Trigger's `call.received` event to auto-decline calls. The server also
 * publishes a shareable call link route, which this resource does not yet cover.
 */
async function buildCallRequest(operation, itemIndex) {
    if (operation !== 'reject') {
        return null;
    }
    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
    const callId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('callId', itemIndex), 'Call ID');
    return {
        endpoint: `/api/sessions/${sessionId}/calls/${callId}/reject`,
        method: 'POST',
        body: {},
    };
}
//# sourceMappingURL=call.js.map