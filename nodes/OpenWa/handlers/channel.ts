import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { requireJid, requireText, toQueryParams } from './params';
import type { RequestSpec } from './types';

/**
 * WhatsApp Channels (newsletters) the session follows.
 *
 * Note that Unsubscribe is a DELETE on the channel itself — it leaves the
 * channel rather than deleting it, which nobody following it could do.
 */
export async function buildChannelRequest(
  this: IExecuteFunctions,
  operation: string,
  itemIndex: number,
): Promise<RequestSpec | null> {
  const sessionId = sanitizePathParam(
    this.getNodeParameter('sessionId', itemIndex) as string,
    'Session ID',
  );
  const base = `/api/sessions/${sessionId}/channels`;

  if (operation === 'list') {
    return { endpoint: base, method: 'GET', body: {} };
  }

  if (operation === 'subscribe') {
    // Accept a full channel link too — the API wants only the invite code, and
    // pasting the whole link is the common slip.
    const inviteCode = requireText(this, 'channelInviteCode', 'Invite code', itemIndex).replace(
      /^https?:\/\/(?:www\.)?whatsapp\.com\/channel\//i,
      '',
    );
    if (!inviteCode) {
      throw new NodeOperationError(this.getNode(), 'Invite code cannot be empty', { itemIndex });
    }
    return { endpoint: `${base}/subscribe`, method: 'POST', body: { inviteCode } };
  }

  const channelId = encodeURIComponent(requireJid(this, 'channelId', 'Channel ID', itemIndex));

  switch (operation) {
    case 'get':
      return { endpoint: `${base}/${channelId}`, method: 'GET', body: {} };
    case 'unsubscribe':
      return { endpoint: `${base}/${channelId}`, method: 'DELETE', body: {} };
    case 'getMessages': {
      const options = this.getNodeParameter('channelListOptions', itemIndex, {}) as IDataObject;
      return {
        endpoint: `${base}/${channelId}/messages`,
        method: 'GET',
        body: {},
        qs: toQueryParams(options),
      };
    }
    default:
      return null;
  }
}
