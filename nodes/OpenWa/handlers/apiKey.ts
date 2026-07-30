import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { requireText, toStringList } from './params';
import type { RequestSpec } from './types';

/**
 * API-key administration.
 *
 * The credential used to call these must itself be an admin key. Create returns
 * the new key's plaintext exactly once — capture it in the same execution,
 * because it cannot be read back afterwards.
 */
export async function buildApiKeyRequest(
  this: IExecuteFunctions,
  operation: string,
  itemIndex: number,
): Promise<RequestSpec | null> {
  const base = '/api/auth/api-keys';

  if (operation === 'validate') {
    // Validates the credential this node is already authenticating with.
    return { endpoint: '/api/auth/validate', method: 'POST', body: {} };
  }

  if (operation === 'list') {
    return { endpoint: base, method: 'GET', body: {} };
  }

  if (operation === 'create') {
    const body: IDataObject = {
      name: requireText(this, 'keyName', 'API key name', itemIndex),
    };
    Object.assign(
      body,
      collectApiKeyFields.call(
        this,
        this.getNodeParameter('keyFields', itemIndex, {}) as IDataObject,
      ),
    );
    return { endpoint: base, method: 'POST', body };
  }

  const apiKeyId = sanitizePathParam(
    this.getNodeParameter('keyId', itemIndex) as string,
    'API key ID',
  );

  switch (operation) {
    case 'get':
      return { endpoint: `${base}/${apiKeyId}`, method: 'GET', body: {} };
    case 'delete':
      return { endpoint: `${base}/${apiKeyId}`, method: 'DELETE', body: {} };
    case 'revoke':
      return { endpoint: `${base}/${apiKeyId}/revoke`, method: 'POST', body: {} };
    case 'update': {
      const body = collectApiKeyFields.call(
        this,
        this.getNodeParameter('keyFields', itemIndex, {}) as IDataObject,
      );
      if (Object.keys(body).length === 0) {
        throw new NodeOperationError(
          this.getNode(),
          'At least one field must be provided to update',
          { itemIndex },
        );
      }
      return { endpoint: `${base}/${apiKeyId}`, method: 'PUT', body };
    }
    default:
      return null;
  }
}

/**
 * Maps the shared optional-fields collection onto the DTO. The two list fields
 * arrive as n8n `multipleValues` strings and are normalised here; an empty list
 * is dropped rather than sent, so it never silently clears a whitelist.
 */
function collectApiKeyFields(this: IExecuteFunctions, fields: IDataObject): IDataObject {
  const body: IDataObject = {};
  if (typeof fields.name === 'string' && fields.name.trim()) {
    body.name = fields.name.trim();
  }
  if (typeof fields.role === 'string' && fields.role) {
    body.role = fields.role;
  }
  if (typeof fields.expiresAt === 'string' && fields.expiresAt) {
    body.expiresAt = fields.expiresAt;
  }
  const allowedIps = toStringList(fields.allowedIps);
  if (allowedIps.length > 0) {
    body.allowedIps = allowedIps;
  }
  const allowedSessions = toStringList(fields.allowedSessions);
  if (allowedSessions.length > 0) {
    body.allowedSessions = allowedSessions;
  }
  return body;
}
