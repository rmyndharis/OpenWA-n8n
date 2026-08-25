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
            name: (0, params_1.requireText)(this, 'templateName', 'Template name', itemIndex, MAX_NAME_LENGTH),
            body: (0, params_1.requireText)(this, 'templateBody', 'Template body', itemIndex, MAX_BODY_LENGTH),
        };
        const header = this.getNodeParameter('templateHeader', itemIndex, '').trim();
        const footer = this.getNodeParameter('templateFooter', itemIndex, '').trim();
        if (header) {
            if (header.length > MAX_HEADER_FOOTER_LENGTH) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Header cannot exceed ${MAX_HEADER_FOOTER_LENGTH} characters`, { itemIndex });
            }
            body.header = header;
        }
        if (footer) {
            if (footer.length > MAX_HEADER_FOOTER_LENGTH) {
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
                if (value === undefined) {
                    continue;
                }
                if (REJECTS_BLANK.has(key)) {
                    body[key] = (0, params_1.optionalNonBlank)(this, value, `Template ${key}`, itemIndex, max);
                    continue;
                }
                if (value.length > max) {
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Template ${key} cannot exceed ${max} characters`, { itemIndex });
                }
                body[key] = value;
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
//# sourceMappingURL=template.js.map