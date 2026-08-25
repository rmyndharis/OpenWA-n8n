import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { optionalNonBlank, requireText } from './params';
import type { RequestSpec } from './types';

// Server-side DTO limits.
const MAX_RULE_NAME_LENGTH = 100;
const MAX_REPLY_TEXT_LENGTH = 4096;

/** Parses the optional match conditions, which reuse the webhook filter shape. */
function parseConditions(
  ctx: IExecuteFunctions,
  raw: unknown,
  itemIndex: number,
): unknown | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new NodeOperationError(ctx.getNode(), 'Conditions must be valid JSON', { itemIndex });
  }
}

/**
 * Autoreply rules: the gateway answers matching inbound messages itself, without
 * a round trip through n8n. Useful for an out-of-hours acknowledgement that must
 * go out even when the workflow is not running.
 */
export async function buildAutomationRuleRequest(
  this: IExecuteFunctions,
  operation: string,
  itemIndex: number,
): Promise<RequestSpec | null> {
  const sessionId = sanitizePathParam(
    this.getNodeParameter('sessionId', itemIndex) as string,
    'Session ID',
  );
  const base = `/api/sessions/${sessionId}/automation-rules`;

  if (operation === 'list') {
    return { endpoint: base, method: 'GET', body: {} };
  }

  if (operation === 'create') {
    const body: Record<string, unknown> = {
      name: requireText(this, 'ruleName', 'Name', itemIndex, MAX_RULE_NAME_LENGTH),
      replyText: requireText(this, 'ruleReplyText', 'Reply text', itemIndex, MAX_REPLY_TEXT_LENGTH),
    };
    const conditions = parseConditions(
      this,
      this.getNodeParameter('ruleConditions', itemIndex, ''),
      itemIndex,
    );
    if (conditions !== undefined) {
      body.conditions = conditions;
    }
    // Both carry server-side defaults, so they are only sent when the user set them.
    const fields = this.getNodeParameter('ruleFields', itemIndex, {}) as {
      cooldownSeconds?: number;
      enabled?: boolean;
    };
    if (fields.cooldownSeconds !== undefined) {
      body.cooldownSeconds = fields.cooldownSeconds;
    }
    if (fields.enabled !== undefined) {
      body.enabled = fields.enabled;
    }
    return { endpoint: base, method: 'POST', body };
  }

  const ruleId = sanitizePathParam(
    this.getNodeParameter('ruleId', itemIndex) as string,
    'Rule ID',
  );

  switch (operation) {
    case 'get':
      return { endpoint: `${base}/${ruleId}`, method: 'GET', body: {} };
    case 'delete':
      return { endpoint: `${base}/${ruleId}`, method: 'DELETE', body: {} };
    case 'update': {
      // A partial update: anything left out keeps its stored value. `name` and
      // `replyText` are non-empty on the server, so a blank one is refused by name
      // rather than dropped, which would report success while leaving it untouched.
      const fields = this.getNodeParameter('ruleUpdateFields', itemIndex, {}) as {
        name?: string;
        replyText?: string;
        conditions?: unknown;
        cooldownSeconds?: number;
        enabled?: boolean;
      };
      const body: Record<string, unknown> = {};
      const name = optionalNonBlank(this, fields.name, 'Name', itemIndex, MAX_RULE_NAME_LENGTH);
      if (name !== undefined) {
        body.name = name;
      }
      const replyText = optionalNonBlank(
        this,
        fields.replyText,
        'Reply text',
        itemIndex,
        MAX_REPLY_TEXT_LENGTH,
      );
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
        throw new NodeOperationError(
          this.getNode(),
          'At least one field must be provided to update',
          { itemIndex },
        );
      }
      return { endpoint: `${base}/${ruleId}`, method: 'PUT', body };
    }
    default:
      return null;
  }
}
