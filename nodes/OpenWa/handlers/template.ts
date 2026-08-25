import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { requireText } from './params';
import type { RequestSpec } from './types';

// Server-side DTO limits.
const MAX_NAME_LENGTH = 100;
const MAX_BODY_LENGTH = 4096;
const MAX_HEADER_FOOTER_LENGTH = 1024;

/**
 * Reusable message templates with `{{variable}}` placeholders, stored per
 * session and rendered by Message → Send Template.
 */
export async function buildTemplateRequest(
  this: IExecuteFunctions,
  operation: string,
  itemIndex: number,
): Promise<RequestSpec | null> {
  const sessionId = sanitizePathParam(
    this.getNodeParameter('sessionId', itemIndex) as string,
    'Session ID',
  );
  const base = `/api/sessions/${sessionId}/templates`;

  if (operation === 'list') {
    return { endpoint: base, method: 'GET', body: {} };
  }

  if (operation === 'create') {
    const body: Record<string, unknown> = {
      name: requireText(this, 'templateName', 'Template name', itemIndex, MAX_NAME_LENGTH),
      body: requireText(this, 'templateBody', 'Template body', itemIndex, MAX_BODY_LENGTH),
    };
    const header = (this.getNodeParameter('templateHeader', itemIndex, '') as string).trim();
    const footer = (this.getNodeParameter('templateFooter', itemIndex, '') as string).trim();
    if (header) {
      if (header.length > MAX_HEADER_FOOTER_LENGTH) {
        throw new NodeOperationError(
          this.getNode(),
          `Header cannot exceed ${MAX_HEADER_FOOTER_LENGTH} characters`,
          { itemIndex },
        );
      }
      body.header = header;
    }
    if (footer) {
      if (footer.length > MAX_HEADER_FOOTER_LENGTH) {
        throw new NodeOperationError(
          this.getNode(),
          `Footer cannot exceed ${MAX_HEADER_FOOTER_LENGTH} characters`,
          { itemIndex },
        );
      }
      body.footer = footer;
    }
    return { endpoint: base, method: 'POST', body };
  }

  const templateId = sanitizePathParam(
    this.getNodeParameter('templateId', itemIndex) as string,
    'Template ID',
  );

  switch (operation) {
    case 'get':
      return { endpoint: `${base}/${templateId}`, method: 'GET', body: {} };
    case 'delete':
      return { endpoint: `${base}/${templateId}`, method: 'DELETE', body: {} };
    case 'update': {
      // Partial update — only the fields the user added are sent.
      const fields = this.getNodeParameter('templateUpdateFields', itemIndex, {}) as {
        name?: string;
        body?: string;
        header?: string;
        footer?: string;
      };
      const limits: Record<string, number> = {
        name: MAX_NAME_LENGTH,
        body: MAX_BODY_LENGTH,
        header: MAX_HEADER_FOOTER_LENGTH,
        footer: MAX_HEADER_FOOTER_LENGTH,
      };
      // `name` and `body` are @IsNotEmpty() on the server, so forwarding a blank one
      // is a guaranteed 400. Treat it as "not supplied" and let the all-empty check
      // below name the real problem. `header` and `footer` carry no such validator:
      // a blank value there is a deliberate clear and must still be sent.
      const REJECTS_BLANK = new Set(['name', 'body']);
      const body: Record<string, unknown> = {};
      for (const [key, max] of Object.entries(limits)) {
        const value = fields[key as keyof typeof fields];
        if (value === undefined) {
          continue;
        }
        if (REJECTS_BLANK.has(key) && value.trim() === '') {
          continue;
        }
        if (value.length > max) {
          throw new NodeOperationError(
            this.getNode(),
            `Template ${key} cannot exceed ${max} characters`,
            { itemIndex },
          );
        }
        body[key] = value;
      }
      if (Object.keys(body).length === 0) {
        throw new NodeOperationError(
          this.getNode(),
          'At least one field must be provided to update',
          { itemIndex },
        );
      }
      return { endpoint: `${base}/${templateId}`, method: 'PUT', body };
    }
    default:
      return null;
  }
}
