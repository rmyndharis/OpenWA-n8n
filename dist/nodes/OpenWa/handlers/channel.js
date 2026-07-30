"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildChannelRequest = buildChannelRequest;
const n8n_workflow_1 = require("n8n-workflow");
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
const params_1 = require("./params");
/**
 * WhatsApp Channels (newsletters) the session follows.
 *
 * Note that Unsubscribe is a DELETE on the channel itself — it leaves the
 * channel rather than deleting it, which nobody following it could do.
 */
async function buildChannelRequest(operation, itemIndex) {
    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
    const base = `/api/sessions/${sessionId}/channels`;
    if (operation === 'list') {
        return { endpoint: base, method: 'GET', body: {} };
    }
    if (operation === 'subscribe') {
        // Accept a full channel link too — the API wants only the invite code, and
        // pasting the whole link is the common slip.
        const inviteCode = (0, params_1.requireText)(this, 'channelInviteCode', 'Invite code', itemIndex).replace(/^https?:\/\/(?:www\.)?whatsapp\.com\/channel\//i, '');
        if (!inviteCode) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Invite code cannot be empty', { itemIndex });
        }
        return { endpoint: `${base}/subscribe`, method: 'POST', body: { inviteCode } };
    }
    const channelId = encodeURIComponent((0, params_1.requireJid)(this, 'channelId', 'Channel ID', itemIndex));
    switch (operation) {
        case 'get':
            return { endpoint: `${base}/${channelId}`, method: 'GET', body: {} };
        case 'unsubscribe':
            return { endpoint: `${base}/${channelId}`, method: 'DELETE', body: {} };
        case 'getMessages': {
            const options = this.getNodeParameter('channelListOptions', itemIndex, {});
            return {
                endpoint: `${base}/${channelId}/messages`,
                method: 'GET',
                body: {},
                qs: (0, params_1.toQueryParams)(options),
            };
        }
        default:
            return null;
    }
}
//# sourceMappingURL=channel.js.map