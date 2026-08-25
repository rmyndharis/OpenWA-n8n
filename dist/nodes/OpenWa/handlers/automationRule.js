"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAutomationRuleRequest = buildAutomationRuleRequest;
const n8n_workflow_1 = require("n8n-workflow");
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
const params_1 = require("./params");
// Server-side DTO limits.
const MAX_RULE_NAME_LENGTH = 100;
const MAX_REPLY_TEXT_LENGTH = 4096;
/** Parses the optional match conditions, which reuse the webhook filter shape. */
function parseConditions(ctx, raw, itemIndex) {
    if (raw === undefined || raw === null || raw === '') {
        return undefined;
    }
    try {
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    }
    catch {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), 'Conditions must be valid JSON', { itemIndex });
    }
}
/**
 * Autoreply rules: the gateway answers matching inbound messages itself, without
 * a round trip through n8n. Useful for an out-of-hours acknowledgement that must
 * go out even when the workflow is not running.
 */
async function buildAutomationRuleRequest(operation, itemIndex) {
    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
    const base = `/api/sessions/${sessionId}/automation-rules`;
    if (operation === 'list') {
        return { endpoint: base, method: 'GET', body: {} };
    }
    if (operation === 'create') {
        const body = {
            name: (0, params_1.requireText)(this, 'ruleName', 'Name', itemIndex, MAX_RULE_NAME_LENGTH),
            replyText: (0, params_1.requireText)(this, 'ruleReplyText', 'Reply text', itemIndex, MAX_REPLY_TEXT_LENGTH),
        };
        const conditions = parseConditions(this, this.getNodeParameter('ruleConditions', itemIndex, ''), itemIndex);
        if (conditions !== undefined) {
            body.conditions = conditions;
        }
        // Both carry server-side defaults, so they are only sent when the user set them.
        const fields = this.getNodeParameter('ruleFields', itemIndex, {});
        if (fields.cooldownSeconds !== undefined) {
            body.cooldownSeconds = fields.cooldownSeconds;
        }
        if (fields.enabled !== undefined) {
            body.enabled = fields.enabled;
        }
        return { endpoint: base, method: 'POST', body };
    }
    const ruleId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('ruleId', itemIndex), 'Rule ID');
    switch (operation) {
        case 'get':
            return { endpoint: `${base}/${ruleId}`, method: 'GET', body: {} };
        case 'delete':
            return { endpoint: `${base}/${ruleId}`, method: 'DELETE', body: {} };
        case 'update': {
            // A partial update: anything left out keeps its stored value. `name` and
            // `replyText` are rejected when blank, so a blank one is treated as unset
            // rather than forwarded as a guaranteed 400.
            const fields = this.getNodeParameter('ruleUpdateFields', itemIndex, {});
            const body = {};
            const name = (fields.name ?? '').trim();
            if (name) {
                if (name.length > MAX_RULE_NAME_LENGTH) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Name cannot exceed ${MAX_RULE_NAME_LENGTH} characters`, { itemIndex });
                }
                body.name = name;
            }
            const replyText = (fields.replyText ?? '').trim();
            if (replyText) {
                if (replyText.length > MAX_REPLY_TEXT_LENGTH) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Reply text cannot exceed ${MAX_REPLY_TEXT_LENGTH} characters`, { itemIndex });
                }
                body.replyText = replyText;
            }
            const conditions = parseConditions(this, fields.conditions, itemIndex);
            if (conditions !== undefined) {
                body.conditions = conditions;
            }
            if (fields.cooldownSeconds !== undefined) {
                body.cooldownSeconds = fields.cooldownSeconds;
            }
            if (fields.enabled !== undefined) {
                body.enabled = fields.enabled;
            }
            if (Object.keys(body).length === 0) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'At least one field must be provided to update', { itemIndex });
            }
            return { endpoint: `${base}/${ruleId}`, method: 'PUT', body };
        }
        default:
            return null;
    }
}
//# sourceMappingURL=automationRule.js.map