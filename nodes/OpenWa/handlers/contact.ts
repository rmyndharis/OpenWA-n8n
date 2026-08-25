import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { requireText, toQueryParams, toStringList, asText } from './params';
import type { RequestSpec } from './types';

// The bulk profile-picture route documents "max 50 used" — beyond that the
// server drops ids without reporting it.
const MAX_PROFILE_PICTURE_IDS = 50;

export async function buildContactRequest(
  this: IExecuteFunctions,
  operation: string,
  itemIndex: number,
): Promise<RequestSpec | null> {
  const sessionId = sanitizePathParam(
    this.getNodeParameter('sessionId', itemIndex) as string,
    'Session ID',
  );

  if (operation === 'list') {
    const options = this.getNodeParameter('contactListOptions', itemIndex, {}) as IDataObject;
    return {
      endpoint: `/api/sessions/${sessionId}/contacts`,
      method: 'GET',
      body: {},
      qs: toQueryParams(options),
    };
  }

  if (operation === 'getProfilePictures') {
    // Bulk variant of getProfilePicture: the ids ride in a required query
    // parameter, so an empty list would fetch nothing and 400.
    const ids = toStringList(this.getNodeParameter('contactIds', itemIndex, ''));
    if (ids.length === 0) {
      throw new NodeOperationError(this.getNode(), 'At least one contact ID is required', {
        itemIndex,
      });
    }
    // The server silently uses only the first 50; refuse rather than drop the rest.
    if (ids.length > MAX_PROFILE_PICTURE_IDS) {
      throw new NodeOperationError(
        this.getNode(),
        `Contact IDs cannot exceed ${MAX_PROFILE_PICTURE_IDS} entries (got ${ids.length}) — the server ignores the rest`,
        { itemIndex },
      );
    }
    return {
      endpoint: `/api/sessions/${sessionId}/contacts/profile-pictures`,
      method: 'GET',
      body: {},
      qs: { ids: ids.join(',') },
    };
  }

  if (operation === 'checkExists') {
    const phoneNumber = asText(this.getNodeParameter('phoneNumber', itemIndex))
      .replace(/[\s+\-()]/g, '');
    if (!phoneNumber || !/^\d+$/.test(phoneNumber)) {
      throw new NodeOperationError(
        this.getNode(),
        'Phone number must contain only digits (no +, spaces, or special characters)',
        { itemIndex },
      );
    }
    return {
      endpoint: `/api/sessions/${sessionId}/contacts/check/${encodeURIComponent(phoneNumber)}`,
      method: 'GET',
      body: {},
    };
  }

  if (operation === 'listBlocked') {
    return {
      endpoint: `/api/sessions/${sessionId}/contacts/blocked`,
      method: 'GET',
      body: {},
    };
  }

  if (
    operation === 'getInfo' ||
    operation === 'block' ||
    operation === 'unblock' ||
    operation === 'getProfilePicture' ||
    operation === 'getPhone' ||
    operation === 'save' ||
    operation === 'delete'
  ) {
    const contactId = asText(this.getNodeParameter('contactId', itemIndex));
    if (!contactId) {
      throw new NodeOperationError(this.getNode(), 'Contact ID cannot be empty', {
        itemIndex,
      });
    }
    const encoded = encodeURIComponent(contactId);
    switch (operation) {
      case 'getInfo':
        return {
          endpoint: `/api/sessions/${sessionId}/contacts/${encoded}`,
          method: 'GET',
          body: {},
        };
      case 'block':
        return {
          endpoint: `/api/sessions/${sessionId}/contacts/${encoded}/block`,
          method: 'POST',
          body: {},
        };
      case 'unblock':
        return {
          endpoint: `/api/sessions/${sessionId}/contacts/${encoded}/block`,
          method: 'DELETE',
          body: {},
        };
      case 'getProfilePicture':
        return {
          endpoint: `/api/sessions/${sessionId}/contacts/${encoded}/profile-picture`,
          method: 'GET',
          body: {},
        };
      case 'save': {
        // A save overwrites the whole entry, so a blank last name is a genuine
        // clear rather than "leave it alone". The key is still omitted when blank:
        // an explicit null reaches the engine and is written as one.
        const body: Record<string, unknown> = {
          firstName: requireText(this, 'contactFirstName', 'First Name', itemIndex, 100),
        };
        const lastName = (
          this.getNodeParameter('contactLastName', itemIndex, '') as string
        ).trim();
        if (lastName) {
          body.lastName = lastName;
        }
        return {
          endpoint: `/api/sessions/${sessionId}/contacts/${encoded}`,
          method: 'PUT',
          body,
        };
      }
      case 'delete':
        return {
          endpoint: `/api/sessions/${sessionId}/contacts/${encoded}`,
          method: 'DELETE',
          body: {},
        };
      default:
        return {
          endpoint: `/api/sessions/${sessionId}/contacts/${encoded}/phone`,
          method: 'GET',
          body: {},
        };
    }
  }

  return null;
}
