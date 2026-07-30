"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCallRequest = buildCallRequest;
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
/**
 * Incoming calls. Only rejection is exposed by the API — pair this with the
 * Trigger's `call.received` event to auto-decline calls.
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