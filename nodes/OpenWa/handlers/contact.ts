import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import type { RequestSpec } from './types';

export async function buildContactRequest(
  this: IExecuteFunctions,
  operation: string,
  itemIndex: number,
): Promise<RequestSpec | null> {
  const sessionId = sanitizePathParam(
    this.getNodeParameter('sessionId', itemIndex) as string,
    'Session ID',
  );

  if (operation === 'checkExists') {
    const phoneNumber = (this.getNodeParameter('phoneNumber', itemIndex) as string)
      .trim()
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

  if (
    operation === 'getInfo' ||
    operation === 'block' ||
    operation === 'unblock' ||
    operation === 'getProfilePicture' ||
    operation === 'getPhone'
  ) {
    const contactId = (this.getNodeParameter('contactId', itemIndex) as string).trim();
    if (!contactId) {
      throw new NodeOperationError(this.getNode(), 'Contact ID cannot be empty', {
        itemIndex,
      });
    }
    const encoded = encodeURIComponent(contactId);
    switch (operation) {
      case 'getInfo':
        return { endpoint: `/api/sessions/${sessionId}/contacts/${encoded}`, method: 'GET', body: {} };
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
