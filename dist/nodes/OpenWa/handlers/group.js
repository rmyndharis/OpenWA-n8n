"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGroupRequest = buildGroupRequest;
const n8n_workflow_1 = require("n8n-workflow");
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
const params_1 = require("./params");
/**
 * Reads a WhatsApp group JID (e.g. 120363021234567890@g.us) from the node
 * parameters. Kept separate from sanitizePathParam because a JID legitimately
 * contains an `@` and a `.`, and the caller needs a NodeOperationError carrying
 * the item index rather than a bare Error.
 */
function getGroupId(itemIndex) {
    const groupId = this.getNodeParameter('groupId', itemIndex).trim();
    if (!groupId) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Group ID cannot be empty', { itemIndex });
    }
    return encodeURIComponent(groupId);
}
// Server-side DTO limits, enforced here so an oversized input fails with a
// pointed message instead of a generic 400 from the API.
const MAX_PARTICIPANTS = 256;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_INVITE_CODE_LENGTH = 128;
/**
 * Reads the participant JID list and normalises it. The API rejects an empty
 * array (`@ArrayNotEmpty`), so catch that here with a message that names the
 * offending field instead of surfacing a generic 400.
 */
function getParticipants(itemIndex) {
    const participants = (0, params_1.toStringList)(this.getNodeParameter('groupParticipants', itemIndex, ''));
    if (participants.length === 0) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'At least one participant is required', {
            itemIndex,
        });
    }
    if (participants.length > MAX_PARTICIPANTS) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Participants cannot exceed ${MAX_PARTICIPANTS} entries (got ${participants.length})`, { itemIndex });
    }
    return participants;
}
async function buildGroupRequest(operation, itemIndex) {
    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
    const base = `/api/sessions/${sessionId}/groups`;
    // --- Session-level operations (no group id) --------------------------------
    if (operation === 'list') {
        const options = this.getNodeParameter('groupListOptions', itemIndex, {});
        const qs = {};
        if (options.limit !== undefined) {
            qs.limit = options.limit;
        }
        if (options.offset !== undefined) {
            qs.offset = options.offset;
        }
        return { endpoint: base, method: 'GET', body: {}, qs };
    }
    if (operation === 'create') {
        const name = this.getNodeParameter('groupName', itemIndex).trim();
        if (!name) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Group name cannot be empty', { itemIndex });
        }
        if (name.length > MAX_NAME_LENGTH) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Group name cannot exceed ${MAX_NAME_LENGTH} characters`, { itemIndex });
        }
        return {
            endpoint: base,
            method: 'POST',
            body: { name, participants: getParticipants.call(this, itemIndex) },
        };
    }
    if (operation === 'join') {
        // Accept a full invite link too — the API wants only the code that follows
        // https://chat.whatsapp.com/, and pasting the whole link is the common slip.
        const inviteCode = this.getNodeParameter('groupInviteCode', itemIndex)
            .trim()
            .replace(/^https?:\/\/chat\.whatsapp\.com\//i, '');
        if (!inviteCode) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Invite code cannot be empty', { itemIndex });
        }
        if (inviteCode.length > MAX_INVITE_CODE_LENGTH) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Invite code cannot exceed ${MAX_INVITE_CODE_LENGTH} characters`, { itemIndex });
        }
        return { endpoint: `${base}/join`, method: 'POST', body: { inviteCode } };
    }
    // --- Group-scoped operations ----------------------------------------------
    const groupId = getGroupId.call(this, itemIndex);
    const groupBase = `${base}/${groupId}`;
    switch (operation) {
        case 'get':
            return { endpoint: groupBase, method: 'GET', body: {} };
        case 'getInviteCode':
            return { endpoint: `${groupBase}/invite-code`, method: 'GET', body: {} };
        case 'getSettings':
            return { endpoint: `${groupBase}/settings`, method: 'GET', body: {} };
        case 'leave':
            return { endpoint: `${groupBase}/leave`, method: 'POST', body: {} };
        case 'revokeInviteCode':
            return { endpoint: `${groupBase}/invite-code/revoke`, method: 'POST', body: {} };
        case 'addParticipants':
            return {
                endpoint: `${groupBase}/participants`,
                method: 'POST',
                body: { participants: getParticipants.call(this, itemIndex) },
            };
        case 'removeParticipants':
            // This DELETE intentionally carries a JSON body — the API takes the
            // participant list there rather than in the query string.
            return {
                endpoint: `${groupBase}/participants`,
                method: 'DELETE',
                body: { participants: getParticipants.call(this, itemIndex) },
            };
        case 'promoteParticipants':
            return {
                endpoint: `${groupBase}/participants/promote`,
                method: 'POST',
                body: { participants: getParticipants.call(this, itemIndex) },
            };
        case 'demoteParticipants':
            return {
                endpoint: `${groupBase}/participants/demote`,
                method: 'POST',
                body: { participants: getParticipants.call(this, itemIndex) },
            };
        case 'updateSubject': {
            const subject = this.getNodeParameter('groupSubject', itemIndex).trim();
            if (!subject) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Subject cannot be empty', { itemIndex });
            }
            if (subject.length > MAX_NAME_LENGTH) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Subject cannot exceed ${MAX_NAME_LENGTH} characters`, { itemIndex });
            }
            return { endpoint: `${groupBase}/subject`, method: 'PUT', body: { subject } };
        }
        case 'updateDescription': {
            // An empty string is valid here: it clears the description. Send it as-is
            // rather than dropping the field, which the API would reject as missing.
            const description = this.getNodeParameter('groupDescription', itemIndex, '');
            if (description.length > MAX_DESCRIPTION_LENGTH) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`, { itemIndex });
            }
            return {
                endpoint: `${groupBase}/description`,
                method: 'PUT',
                body: { description },
            };
        }
        case 'updateSettings': {
            const settings = this.getNodeParameter('groupSettings', itemIndex, {});
            const body = {};
            if (settings.announce !== undefined) {
                body.announce = settings.announce;
            }
            if (settings.locked !== undefined) {
                body.locked = settings.locked;
            }
            if (settings.ephemeralSeconds !== undefined) {
                body.ephemeralSeconds = settings.ephemeralSeconds;
            }
            if (Object.keys(body).length === 0) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'At least one setting must be provided to update', { itemIndex });
            }
            return { endpoint: `${groupBase}/settings`, method: 'PUT', body };
        }
        default:
            return null;
    }
}
//# sourceMappingURL=group.js.map