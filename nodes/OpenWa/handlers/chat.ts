import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { requireJid, toQueryParams } from './params';
import type { RequestSpec } from './types';

/**
 * Chat-level operations. These live under the session routes on the server
 * (`/api/sessions/:id/chats/...`) but are their own resource in the node,
 * because they act on a conversation rather than on the session itself.
 */
export async function buildChatRequest(
  this: IExecuteFunctions,
  operation: string,
  itemIndex: number,
): Promise<RequestSpec | null> {
  const sessionId = sanitizePathParam(
    this.getNodeParameter('sessionId', itemIndex) as string,
    'Session ID',
  );
  const base = `/api/sessions/${sessionId}/chats`;

  if (operation === 'list') {
    const options = this.getNodeParameter('chatListOptions', itemIndex, {}) as IDataObject;
    return { endpoint: base, method: 'GET', body: {}, qs: toQueryParams(options) };
  }

  // Every remaining operation posts the target chat in the body rather than the path.
  const chatId = requireJid(this, 'chatId', 'Chat ID', itemIndex);

  switch (operation) {
    case 'markRead':
      return { endpoint: `${base}/read`, method: 'POST', body: { chatId } };
    case 'markUnread':
      return { endpoint: `${base}/unread`, method: 'POST', body: { chatId } };
    case 'delete':
      // A POST, not a DELETE — the server takes the chat id in the body here.
      return { endpoint: `${base}/delete`, method: 'POST', body: { chatId } };
    case 'setState': {
      // 'typing'/'recording' show the indicator, 'paused' clears it.
      const state = this.getNodeParameter('chatState', itemIndex, 'typing') as string;
      return { endpoint: `${base}/typing`, method: 'POST', body: { chatId, state } };
    }
    default:
      return null;
  }
}
