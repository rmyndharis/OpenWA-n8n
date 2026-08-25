"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCallRequest = buildCallRequest;
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
const params_1 = require("./params");
/**
 * Calls. Reject declines a ringing call, which pairs with the Trigger's
 * `call.received` event to auto-decline; Create Link produces a shareable
 * WhatsApp call link that anyone can join.
 */
async function buildCallRequest(operation, itemIndex) {
    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
    const base = `/api/sessions/${sessionId}/calls`;
    switch (operation) {
        case 'reject': {
            const callId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('callId', itemIndex), 'Call ID');
            return { endpoint: `${base}/${callId}/reject`, method: 'POST', body: {} };
        }
        case 'createLink': {
            const raw = this.getNodeParameter('callLinkStartTime', itemIndex, '');
            // Both fields are required by the DTO. "Now" is the ordinary case, so a blank
            // picker means now rather than an omitted key, which would be a 400.
            const startTime = raw === '' || raw === undefined || raw === null
                ? Date.now()
                : (0, params_1.toEpochMs)(this, raw, 'Start time', itemIndex);
            return {
                endpoint: `${base}/link`,
                method: 'POST',
                body: {
                    type: this.getNodeParameter('callLinkType', itemIndex, 'video'),
                    startTime,
                },
            };
        }
        default:
            return null;
    }
}
//# sourceMappingURL=call.js.map