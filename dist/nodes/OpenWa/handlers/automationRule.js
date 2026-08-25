"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAutomationRuleRequest = buildAutomationRuleRequest;
const n8n_workflow_1 = require("n8n-workflow");
const jsonParam_1 = require("../../shared/jsonParam");
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
const params_1 = require("./params");
// Server-side DTO limits.
const MAX_RULE_NAME_LENGTH = 100;
const MAX_REPLY_TEXT_LENGTH = 4096;
/**
 * Parses the optional match conditions, which reuse the webhook filter shape.
 * Shares the Trigger's reader so the two identically shaped fields agree on
 * whitespace, on an already-resolved object, and on null.
 */
function parseConditions(ctx, raw, itemIndex) {
    try {
        return (0, jsonParam_1.parseJsonParam)(raw);
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
            // `replyText` are non-empty on the server, so a blank one is refused by name
            // rather than dropped, which would report success while leaving it untouched.
            const fields = this.getNodeParameter('ruleUpdateFields', itemIndex, {});
            const body = {};
            const name = (0, params_1.optionalNonBlank)(this, fields.name, 'Name', itemIndex, MAX_RULE_NAME_LENGTH);
            if (name !== undefined) {
                body.name = name;
            }
            const replyText = (0, params_1.optionalNonBlank)(this, fields.replyText, 'Reply text', itemIndex, MAX_REPLY_TEXT_LENGTH);
            if (replyText !== undefined) {
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