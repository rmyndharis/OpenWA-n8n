import type { IExecuteFunctions } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { requireJid } from './params';
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

  if (operation === 'get') {
    const labelId = sanitizePathParam(
      this.getNodeParameter('labelId', itemIndex) as string,
      'Label ID',
    );
    return { endpoint: `${base}/${labelId}`, method: 'GET', body: {} };
  }

  // The remaining operations are all scoped to one chat.
  const chatId = encodeURIComponent(requireJid(this, 'chatId', 'Chat ID', itemIndex));

  switch (operation) {
    case 'getForChat':
      return { endpoint: `${base}/chat/${chatId}`, method: 'GET', body: {} };
    case 'addToChat': {
      const labelId = (this.getNodeParameter('labelId', itemIndex) as string).trim();
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
