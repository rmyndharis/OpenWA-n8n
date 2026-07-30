"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireJid = requireJid;
exports.requireText = requireText;
exports.toQueryParams = toQueryParams;
exports.toStringList = toStringList;
const n8n_workflow_1 = require("n8n-workflow");
/**
 * Reads a required WhatsApp JID (e.g. 628123456789@c.us, 1203630@g.us) and
 * returns it trimmed. Callers that put it in a URL path wrap it in
 * `encodeURIComponent`; callers that send it in a body use it as-is.
 *
 * Kept apart from sanitizePathParam because a JID legitimately contains `@` and
 * `.`, and because the caller needs a NodeOperationError carrying the item index
 * rather than the bare Error that helper throws.
 */
function requireJid(ctx, paramName, label, itemIndex) {
    const value = ctx.getNodeParameter(paramName, itemIndex).trim();
    if (!value) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `${label} cannot be empty`, { itemIndex });
    }
    return value;
}
/**
 * Reads a required free-text parameter, trimmed, optionally length-checked
 * against the server's DTO limit so oversized input fails with a pointed
 * message instead of a generic 400.
 */
function requireText(ctx, paramName, label, itemIndex, maxLength) {
    const value = ctx.getNodeParameter(paramName, itemIndex).trim();
    if (!value) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `${label} cannot be empty`, { itemIndex });
    }
    if (maxLength !== undefined && value.length > maxLength) {
        throw new n8n_workflow_1.NodeOperationError(ctx.getNode(), `${label} cannot exceed ${maxLength} characters`, {
            itemIndex,
        });
    }
    return value;
}
/**
 * Turns a `collection` parameter into a query object.
 *
 * Only entries the user actually added are present, so anything left undefined,
 * null, or blank is dropped. `0` and `false` are meaningful values here (offset
 * 0, a disabled flag) and are deliberately kept.
 */
function toQueryParams(options) {
    const qs = {};
    for (const [key, value] of Object.entries(options ?? {})) {
        if (value !== undefined && value !== null && value !== '') {
            qs[key] = value;
        }
    }
    return qs;
}
/**
 * Normalises a list parameter into a trimmed, blank-free array of strings.
 *
 * These fields are plain strings rather than n8n `multipleValues` collections so
 * that they can be driven by an expression — a fixed set of input rows cannot
 * scale to a list only known at runtime. That means three shapes reach us, and
 * all three are accepted:
 *
 *   - a real array, when an expression resolves to one (`{{ $json.ids }}`)
 *   - a JSON array string, when one is pasted or built as text
 *   - a comma- or newline-separated string, when typed by hand
 *
 * Returns an empty array when nothing was provided.
 */
function toStringList(raw) {
    if (raw === undefined || raw === null || raw === '') {
        return [];
    }
    if (Array.isArray(raw)) {
        return raw.map((v) => String(v).trim()).filter(Boolean);
    }
    if (typeof raw !== 'string') {
        return [String(raw).trim()].filter(Boolean);
    }
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.map((v) => String(v).trim()).filter(Boolean);
            }
        }
        catch {
            // Not valid JSON after all — fall through and treat it as a plain
            // separated list rather than failing on a stray bracket.
        }
    }
    return trimmed
        .split(/[,\n]/)
        .map((v) => v.trim())
        .filter(Boolean);
}
//# sourceMappingURL=params.js.map