"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildChatRequest = buildChatRequest;
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
const params_1 = require("./params");
/**
 * Chat-level operations. These live under the session routes on the server
 * (`/api/sessions/:id/chats/...`) but are their own resource in the node,
 * because they act on a conversation rather than on the session itself.
 */
async function buildChatRequest(operation, itemIndex) {
    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
    const base = `/api/sessions/${sessionId}/chats`;
    if (operation === 'list') {
        const options = this.getNodeParameter('chatListOptions', itemIndex, {});
        return { endpoint: base, method: 'GET', body: {}, qs: (0, params_1.toQueryParams)(options) };
    }
    // Every remaining operation posts the target chat in the body rather than the path.
    const chatId = (0, params_1.requireJid)(this, 'chatId', 'Chat ID', itemIndex);
    switch (operation) {
        case 'markRead':
            return { endpoint: `${base}/read`, method: 'POST', body: { chatId } };
        case 'markUnread':
            return { endpoint: `${base}/unread`, method: 'POST', body: { chatId } };
        case 'delete':
            // A POST, not a DELETE — the server takes the chat id in the body here.
            return { endpoint: `${base}/delete`, method: 'POST', body: { chatId } };
        case 'setState': {
            // 'typing'/'recording' show the indicator, 'paused' clears it.
            const state = this.getNodeParameter('chatState', itemIndex, 'typing');
            return { endpoint: `${base}/typing`, method: 'POST', body: { chatId, state } };
        }
        default:
            return null;
    }
}
//# sourceMappingURL=chat.js.map