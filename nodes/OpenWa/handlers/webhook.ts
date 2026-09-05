import type { IDataObject, IExecuteFunctions, INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { webhookSecretProblem } from '../../shared/webhookSecret';
import { toQueryParams } from './params';
import type { RequestSpec } from './types';

/**
 * Parses a JSON object field (headers, filters) supplied as text or already as an
 * object, so Create and Update read them the same way.
 */
function parseJsonObject(node: INode, raw: unknown, label: string, itemIndex: number): unknown {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    throw new NodeOperationError(node, `${label} must be valid JSON`, { itemIndex });
  }
}

function assertSecretLength(node: INode, secret: string, itemIndex: number): void {
  const problem = webhookSecretProblem(secret);
  if (problem) {
    throw new NodeOperationError(node, problem, { itemIndex });
  }
}

export async function buildWebhookRequest(
  this: IExecuteFunctions,
  operation: string,
  itemIndex: number,
): Promise<RequestSpec | null> {
  // These two span every session, so they are resolved before the Session ID
  // field is read — it is not shown for them.
  if (operation === 'listAll') {
    const options = this.getNodeParameter('webhookListOptions', itemIndex, {}) as IDataObject;
    return { endpoint: '/api/webhooks', method: 'GET', body: {}, qs: toQueryParams(options) };
  }

  if (operation === 'getDeliveryFailures') {
    // Its own collection, not the List All one: this route is the only of the
    // two that accepts a sessionId filter.
    const options = this.getNodeParameter('deliveryFailureOptions', itemIndex, {}) as IDataObject;
    return {
      endpoint: '/api/webhooks/delivery-failures',
      method: 'GET',
      body: {},
      qs: toQueryParams(options),
    };
  }

  const sessionId = sanitizePathParam(
    this.getNodeParameter('sessionId', itemIndex) as string,
    'Session ID',
  );

  if (operation === 'list') {
    return { endpoint: `/api/sessions/${sessionId}/webhooks`, method: 'GET', body: {} };
  }

  if (operation === 'get') {
    const webhookId = sanitizePathParam(
      this.getNodeParameter('webhookId', itemIndex) as string,
      'Webhook ID',
    );
    return {
      endpoint: `/api/sessions/${sessionId}/webhooks/${webhookId}`,
      method: 'GET',
      body: {},
    };
  }

  if (operation === 'create') {
    const events = this.getNodeParameter('events', itemIndex) as string[];
    if (!events || events.length === 0) {
      throw new NodeOperationError(this.getNode(), 'At least one event must be selected', {
        itemIndex,
      });
    }
    const body: Record<string, unknown> = {
      url: this.getNodeParameter('webhookUrl', itemIndex) as string,
      events,
    };
    const webhookSecret = this.getNodeParameter('webhookSecret', itemIndex, '') as string;
    assertSecretLength(this.getNode(), webhookSecret, itemIndex);
    if (webhookSecret) {
      body.secret = webhookSecret;
    }
    // The same three optional fields the Update operation already exposes. Filters
    // are what let the gateway drop uninteresting events before they ever reach n8n.
    const createFields = this.getNodeParameter('webhookCreateFields', itemIndex, {}) as Record<
      string,
      unknown
    >;
    if (createFields.retryCount !== undefined) {
      body.retryCount = createFields.retryCount;
    }
    for (const [key, label] of [
      ['headers', 'Headers'],
      ['filters', 'Filters'],
    ] as const) {
      const raw = createFields[key];
      if (raw === undefined || raw === null || raw === '') {
        continue;
      }
      body[key] = parseJsonObject(this.getNode(), raw, label, itemIndex);
    }
    return { endpoint: `/api/sessions/${sessionId}/webhooks`, method: 'POST', body };
  }

  if (operation === 'delete') {
    const webhookId = sanitizePathParam(
      this.getNodeParameter('webhookId', itemIndex) as string,
      'Webhook ID',
    );
    return {
      endpoint: `/api/sessions/${sessionId}/webhooks/${webhookId}`,
      method: 'DELETE',
      body: {},
    };
  }

  if (operation === 'update') {
    const webhookId = sanitizePathParam(
      this.getNodeParameter('webhookId', itemIndex) as string,
      'Webhook ID',
    );
    const body: Record<string, unknown> = {};
    const updateFields = this.getNodeParameter('updateFields', itemIndex, {}) as Record<
      string,
      unknown
    >;
    // Only forward the fields the user set — the server treats the PUT as a partial
    // update, so unspecified fields keep their current value.
    for (const key of ['url', 'events', 'active', 'retryCount'] as const) {
      if (updateFields[key] !== undefined) {
        body[key] = updateFields[key];
      }
    }
    // The server reads an empty secret as "stop signing" (`@ValidateIf(o => o.secret
    // !== '')` skips the 16-character floor for exactly that value). A blank field
    // cannot carry that instruction, because an n8n collection yields the empty
    // default as soon as the field is added, so a blank is dropped and the clear is
    // spelled with its own toggle instead.
    if (updateFields.clearSecret === true) {
      body.secret = '';
    } else if (typeof updateFields.secret === 'string' && updateFields.secret.trim() !== '') {
      assertSecretLength(this.getNode(), updateFields.secret, itemIndex);
      body.secret = updateFields.secret;
    }
    // Mirror the create-webhook guard so an empty Events selection fails with a clear
    // message here instead of a raw server 400 (the DTO requires at least one event).
    if (Array.isArray(body.events) && body.events.length === 0) {
      throw new NodeOperationError(
        this.getNode(),
        'At least one event must be selected when updating events',
        { itemIndex },
      );
    }
    // Headers are non-nullable server-side (clear them by sending {}); filters are
    // nullable and can only be cleared by sending null (the validator rejects {}).
    for (const key of ['headers', 'filters'] as const) {
      const raw = updateFields[key];
      if (raw === undefined) continue; // field not added — nothing to send
      if (key === 'filters' && (raw === null || raw === 'null')) {
        body.filters = null; // explicit null clears existing filters
        continue;
      }
      // Headers are NOT NULL server-side and clear with an empty object, so null
      // would be written straight into the column and fail the constraint. Accept
      // the same gesture the sibling field documents and send what the column takes.
      if (key === 'headers' && (raw === null || raw === 'null')) {
        body.headers = {};
        continue;
      }
      if (raw === null || raw === '') continue; // blank value — nothing to send
      body[key] = parseJsonObject(
        this.getNode(),
        raw,
        key === 'headers' ? 'Headers' : 'Filters',
        itemIndex,
      );
    }
    // Every field on this route is optional server-side, so an empty body is a 200
    // that changed nothing. Refuse it here, the way every other update operation in
    // this node does, rather than reporting success for a request that did nothing.
    if (Object.keys(body).length === 0) {
      throw new NodeOperationError(
        this.getNode(),
        'At least one field must be provided to update',
        { itemIndex },
      );
    }
    return {
      endpoint: `/api/sessions/${sessionId}/webhooks/${webhookId}`,
      method: 'PUT',
      body,
    };
  }

  if (operation === 'test') {
    const webhookId = sanitizePathParam(
      this.getNodeParameter('webhookId', itemIndex) as string,
      'Webhook ID',
    );
    return {
      endpoint: `/api/sessions/${sessionId}/webhooks/${webhookId}/test`,
      method: 'POST',
      body: {},
    };
  }

  return null;
}
