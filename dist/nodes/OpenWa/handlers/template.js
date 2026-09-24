"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTemplateRequest = buildTemplateRequest;
const n8n_workflow_1 = require("n8n-workflow");
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
const params_1 = require("./params");
// Server-side DTO limits.
const MAX_NAME_LENGTH = 100;
const MAX_BODY_LENGTH = 4096;
const MAX_HEADER_FOOTER_LENGTH = 1024;
/**
 * Reusable message templates with `{{variable}}` placeholders, stored per
 * session and rendered by Message → Send Template.
 */
async function buildTemplateRequest(operation, itemIndex) {
    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
    const base = `/api/sessions/${sessionId}/templates`;
    if (operation === 'list') {
        return { endpoint: base, method: 'GET', body: {} };
    }
    if (operation === 'create') {
        const body = {
            name: (0, params_1.assertStoredName)(this, (0, params_1.requireText)(this, 'templateName', 'Template name', itemIndex, MAX_NAME_LENGTH), 'Template name', MAX_NAME_LENGTH, itemIndex),
            body: (0, params_1.requireText)(this, 'templateBody', 'Template body', itemIndex, MAX_BODY_LENGTH),
        };
        const header = (0, params_1.asText)(this.getNodeParameter('templateHeader', itemIndex, ''), 'Header');
        const footer = (0, params_1.asText)(this.getNodeParameter('templateFooter', itemIndex, ''), 'Footer');
        if (header) {
            if ((0, params_1.textLength)(header) > MAX_HEADER_FOOTER_LENGTH) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Header cannot exceed ${MAX_HEADER_FOOTER_LENGTH} characters`, { itemIndex });
            }
            body.header = header;
        }
        if (footer) {
            if ((0, params_1.textLength)(footer) > MAX_HEADER_FOOTER_LENGTH) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Footer cannot exceed ${MAX_HEADER_FOOTER_LENGTH} characters`, { itemIndex });
            }
            body.footer = footer;
        }
        return { endpoint: base, method: 'POST', body };
    }
    const templateId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('templateId', itemIndex), 'Template ID');
    switch (operation) {
        case 'get':
            return { endpoint: `${base}/${templateId}`, method: 'GET', body: {} };
        case 'delete':
            return { endpoint: `${base}/${templateId}`, method: 'DELETE', body: {} };
        case 'update': {
            // Partial update — only the fields the user added are sent.
            const fields = this.getNodeParameter('templateUpdateFields', itemIndex, {});
            (0, params_1.assertFieldsResolved)(this, fields, { body: 'Body', footer: 'Footer', header: 'Header', name: 'Name' }, params_1.LEAVE_UNCHANGED, itemIndex);
            const limits = {
                name: MAX_NAME_LENGTH,
                body: MAX_BODY_LENGTH,
                header: MAX_HEADER_FOOTER_LENGTH,
                footer: MAX_HEADER_FOOTER_LENGTH,
            };
            // `name` and `body` are @IsNotEmpty() on the server, so a blank one can never
            // mean anything: it is refused by name rather than dropped, which would report
            // success while leaving the field untouched. `header` and `footer` carry no
            // such validator, so a blank value there is a deliberate clear and is sent.
            const REJECTS_BLANK = new Set(['name', 'body']);
            const body = {};
            for (const [key, max] of Object.entries(limits)) {
                const value = fields[key];
                // Absent: a present field that resolved to nothing was refused above.
                if (value === undefined) {
                    continue;
                }
                if (REJECTS_BLANK.has(key)) {
                    // Only assign a real value. Writing the helper's undefined would leave the
                    // key present, so the all-empty guard below would not fire and the request
                    // would go out as {}, reporting success while changing nothing.
                    const parsed = (0, params_1.optionalNonBlank)(this, value, `Template ${key}`, itemIndex, max);
                    if (parsed !== undefined) {
                        body[key] =
                            key === 'name'
                                ? (0, params_1.assertStoredName)(this, parsed, 'Template name', max, itemIndex)
                                : parsed;
                    }
                    continue;
                }
                // Coerced for the same reason the blank-rejecting branch routes through
                // optionalNonBlank: an expression can resolve to a number, whose `.length`
                // is undefined, so the cap would pass and the server would answer a 400
                // naming no field. A blank stays blank here, which clears the field.
                const text = (0, params_1.asText)(value, `Template ${key}`);
                if ((0, params_1.textLength)(text) > max) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Template ${key} cannot exceed ${max} characters`, { itemIndex });
                }
                body[key] = text;
            }
            if (Object.keys(body).length === 0) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'At least one field must be provided to update', { itemIndex });
            }
            return { endpoint: `${base}/${templateId}`, method: 'PUT', body };
        }
        default:
            return null;
    }
}
