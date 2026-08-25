import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { requireJid, toQueryParams, toStringList } from './params';
import type { RequestSpec } from './types';

/** Server-side cap on MarkChatReadDto.messageIds. */
const MAX_READ_MESSAGE_IDS = 100;

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
    case 'markRead': {
      const body: Record<string, unknown> = { chatId };
      // Omit the field entirely when nothing was named: the DTO sets `minItems: 1`,
      // so an empty array is refused, and `null` reaches the Baileys adapter and 400s.
      const messageIds = toStringList(this.getNodeParameter('readMessageIds', itemIndex, ''));
      if (messageIds.length > 0) {
        if (messageIds.length > MAX_READ_MESSAGE_IDS) {
          throw new NodeOperationError(
            this.getNode(),
            `Mark Read accepts at most ${MAX_READ_MESSAGE_IDS} message IDs (got ${messageIds.length})`,
            { itemIndex },
          );
        }
        body.messageIds = messageIds;
      }
      return { endpoint: `${base}/read`, method: 'POST', body };
    }
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
