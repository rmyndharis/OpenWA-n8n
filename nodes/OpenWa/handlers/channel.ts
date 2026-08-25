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

  if (operation === 'create') {
    const body: Record<string, unknown> = {
      name: requireText(this, 'channelName', 'Channel name', itemIndex, 100),
    };
    // Omit rather than send '': an empty string validates and is forwarded as a
    // real empty description rather than "no description".
    const description = (
      this.getNodeParameter('channelDescription', itemIndex, '') as string
    ).trim();
    if (description) {
      if (description.length > 2048) {
        throw new NodeOperationError(
          this.getNode(),
          'Channel description cannot exceed 2048 characters',
          { itemIndex },
        );
      }
      body.description = description;
    }
    return { endpoint: base, method: 'POST', body };
  }

  const channelId = encodeURIComponent(requireJid(this, 'channelId', 'Channel ID', itemIndex));

  switch (operation) {
    case 'get':
      return { endpoint: `${base}/${channelId}`, method: 'GET', body: {} };
    case 'unsubscribe':
      // Unfollows the channel for this account only. Destroying it for everyone is
      // the separate Delete operation below, deliberately on a different verb and
      // path so a slip cannot turn "leave" into "destroy".
      return { endpoint: `${base}/${channelId}`, method: 'DELETE', body: {} };
    case 'delete':
      return { endpoint: `${base}/${channelId}/delete`, method: 'POST', body: {} };
    case 'mute':
      // No server-side default, so the flag is always sent.
      return {
        endpoint: `${base}/${channelId}/mute`,
        method: 'POST',
        body: { mute: this.getNodeParameter('channelMute', itemIndex, true) as boolean },
      };
    case 'demoteAdmin':
      return {
        endpoint: `${base}/${channelId}/admins/demote`,
        method: 'POST',
        body: { userId: requireJid(this, 'channelUserId', 'User ID', itemIndex) },
      };
    case 'transferOwnership':
      return {
        endpoint: `${base}/${channelId}/owner/transfer`,
        method: 'POST',
        body: {
          newOwnerId: requireJid(this, 'channelNewOwnerId', 'New owner ID', itemIndex),
        },
      };
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
