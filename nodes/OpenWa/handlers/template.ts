import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { optionalNonBlank, requireText, asText } from './params';
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
    const header = asText(this.getNodeParameter('templateHeader', itemIndex, ''));
    const footer = asText(this.getNodeParameter('templateFooter', itemIndex, ''));
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
      // `name` and `body` are @IsNotEmpty() on the server, so a blank one can never
      // mean anything: it is refused by name rather than dropped, which would report
      // success while leaving the field untouched. `header` and `footer` carry no
      // such validator, so a blank value there is a deliberate clear and is sent.
      const REJECTS_BLANK = new Set(['name', 'body']);
      const body: Record<string, unknown> = {};
      for (const [key, max] of Object.entries(limits)) {
        const value = fields[key as keyof typeof fields];
        // null as well as undefined: a collection subfield driven by an expression
        // can resolve to null, and letting it through reaches `value.length` below.
        if (value === undefined || value === null) {
          continue;
        }
        if (REJECTS_BLANK.has(key)) {
          // Only assign a real value. Writing the helper's undefined would leave the
          // key present, so the all-empty guard below would not fire and the request
          // would go out as {}, reporting success while changing nothing.
          const parsed = optionalNonBlank(this, value, `Template ${key}`, itemIndex, max);
          if (parsed !== undefined) {
            body[key] = parsed;
          }
          continue;
        }
        // Coerced for the same reason the blank-rejecting branch routes through
        // optionalNonBlank: an expression can resolve to a number, whose `.length`
        // is undefined, so the cap would pass and the server would answer a 400
        // naming no field. A blank stays blank here, which clears the field.
        const text = asText(value);
        if (text.length > max) {
          throw new NodeOperationError(
            this.getNode(),
            `Template ${key} cannot exceed ${max} characters`,
            { itemIndex },
          );
        }
        body[key] = text;
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
