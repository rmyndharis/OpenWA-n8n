"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildChatRequest = buildChatRequest;
const n8n_workflow_1 = require("n8n-workflow");
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
const params_1 = require("./params");
/** Server-side cap on MarkChatReadDto.messageIds. */
const MAX_READ_MESSAGE_IDS = 100;
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
    // Clear Messages is the odd one out: it names its chat in the PATH, while every
    // other chat route carries it in the body.
    if (operation === 'clearMessages') {
        const chatId = (0, params_1.requireJid)(this, 'chatId', 'Chat ID', itemIndex);
        return {
            endpoint: `${base}/${encodeURIComponent(chatId)}/messages`,
            method: 'DELETE',
            body: {},
        };
    }
    // Every remaining operation posts the target chat in the body rather than the path.
    const chatId = (0, params_1.requireJid)(this, 'chatId', 'Chat ID', itemIndex);
    switch (operation) {
        case 'markRead': {
            const body = { chatId };
            // Omit the field entirely when nothing was named: the DTO sets `minItems: 1`,
            // so an empty array is refused, and `null` reaches the Baileys adapter and 400s.
            const messageIds = (0, params_1.toStringList)(this.getNodeParameter('readMessageIds', itemIndex, ''));
            if (messageIds.length > 0) {
                if (messageIds.length > MAX_READ_MESSAGE_IDS) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Mark Read accepts at most ${MAX_READ_MESSAGE_IDS} message IDs (got ${messageIds.length})`, { itemIndex });
                }
                body.messageIds = messageIds;
            }
            return { endpoint: `${base}/read`, method: 'POST', body };
        }
        case 'markUnread':
            return { endpoint: `${base}/unread`, method: 'POST', body: { chatId } };
        case 'delete':
            // A POST, not a DELETE — the server takes the chat id in the body here.
            return { endpoint: `${base}/delete`, method: 'POST', body: { chatId } };
        case 'archive':
            // Always sent: the flag has no server-side default, so omitting it is a 400.
            return {
                endpoint: `${base}/archive`,
                method: 'POST',
                body: { chatId, archive: this.getNodeParameter('archive', itemIndex, true) },
            };
        case 'pin':
            return {
                endpoint: `${base}/pin`,
                method: 'POST',
                body: { chatId, pin: this.getNodeParameter('pin', itemIndex, true) },
            };
        case 'mute': {
            const raw = this.getNodeParameter('muteUntil', itemIndex, '');
            // The key is always present. Omitting it is a 400, while an explicit null is
            // how a chat is unmuted, so blank has to become null rather than disappear.
            const muteUntil = raw === '' || raw === undefined || raw === null
                ? null
                : (0, params_1.toEpochMs)(this, raw, 'Mute Until', itemIndex);
            return { endpoint: `${base}/mute`, method: 'POST', body: { chatId, muteUntil } };
        }
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