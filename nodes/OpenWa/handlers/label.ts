import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { optionalNonBlank, requireJid, requireText } from './params';
import type { RequestSpec } from './types';

/**
 * WhatsApp Business labels — the catalogue of labels on the account, and the
 * labels attached to an individual chat.
 */
export async function buildLabelRequest(
  this: IExecuteFunctions,
  operation: string,
  itemIndex: number,
): Promise<RequestSpec | null> {
  const sessionId = sanitizePathParam(
    this.getNodeParameter('sessionId', itemIndex) as string,
    'Session ID',
  );
  const base = `/api/sessions/${sessionId}/labels`;

  if (operation === 'list') {
    return { endpoint: base, method: 'GET', body: {} };
  }

  if (operation === 'get' || operation === 'getChats') {
    const labelId = sanitizePathParam(
      this.getNodeParameter('labelId', itemIndex) as string,
      'Label ID',
    );
    return {
      endpoint: operation === 'get' ? `${base}/${labelId}` : `${base}/${labelId}/chats`,
      method: 'GET',
      body: {},
    };
  }

  if (operation === 'upsert' || operation === 'delete') {
    // The id is caller-chosen rather than server-assigned, so this takes a plain
    // text field: the picker can only ever offer labels that already exist, which
    // would leave creation reachable only through an expression.
    const labelId = sanitizePathParam(
      this.getNodeParameter('newLabelId', itemIndex) as string,
      'Label ID',
    );
    if (operation === 'delete') {
      return { endpoint: `${base}/${labelId}`, method: 'DELETE', body: {} };
    }
    const fields = this.getNodeParameter('labelFields', itemIndex, {}) as {
      labelName?: string;
      labelColor?: number;
    };
    const body: Record<string, unknown> = {};
    // Refused rather than dropped when blank: the server marks it non-empty, so a
    // blank cannot mean "clear the name" and dropping it would report success
    // while leaving the label's name untouched.
    const name = optionalNonBlank(this, fields.labelName, 'Label name', itemIndex, 100);
    if (name !== undefined) {
      body.name = name;
    }
    // 0 is a real colour, so this tests for presence rather than truthiness. The
    // field lives in a collection precisely so "not set" stays distinguishable.
    // null is excluded with it: an expression resolving to one satisfied the guard
    // below and then reached a server that reads null as "not set", replacing this
    // message with a bare 400.
    if (fields.labelColor !== undefined && fields.labelColor !== null) {
      body.color = fields.labelColor;
    }
    if (Object.keys(body).length === 0) {
      throw new NodeOperationError(
        this.getNode(),
        'At least one of Name or Color must be provided',
        { itemIndex },
      );
    }
    return { endpoint: `${base}/${labelId}`, method: 'PUT', body };
  }

  // The remaining operations are all scoped to one chat.
  const chatId = encodeURIComponent(requireJid(this, 'chatId', 'Chat ID', itemIndex));

  switch (operation) {
    case 'getForChat':
      return { endpoint: `${base}/chat/${chatId}`, method: 'GET', body: {} };
    case 'addToChat': {
      const labelId = requireText(this, 'labelId', 'Label ID', itemIndex);
      return { endpoint: `${base}/chat/${chatId}`, method: 'POST', body: { labelId } };
    }
    case 'removeFromChat': {
      const labelId = sanitizePathParam(
        this.getNodeParameter('labelId', itemIndex) as string,
        'Label ID',
      );
      return { endpoint: `${base}/chat/${chatId}/${labelId}`, method: 'DELETE', body: {} };
    }
    default:
      return null;
  }
}
