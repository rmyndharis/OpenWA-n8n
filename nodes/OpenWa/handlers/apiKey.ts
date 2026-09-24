import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import {
  asText,
  isExpression,
  assertFieldsResolved,
  LEAVE_UNCHANGED,
  optionalNonBlank,
  requireText,
  toEpochMs,
  toStringList,
} from './params';
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
    // Fields > Name is the Update rename. Read here it silently replaced the required
    // Name, so a copied Update node created its key under the old name.
    const fields = { ...(this.getNodeParameter('keyFields', itemIndex, {}) as IDataObject) };
    delete fields.name;
    // A restriction with no value is refused here too: dropping it would create a
    // key broader than the one asked for. That includes a list whose expression
    // found no entries, which reads the same as one left out once resolved.
    const raw = (this.getNode().parameters.keyFields ?? {}) as IDataObject;
    for (const [key, label] of [
      ['allowedIps', 'Allowed IPs'],
      ['allowedSessions', 'Allowed Sessions'],
      ['allowedChats', 'Allowed Chats'],
    ] as const) {
      if (isExpression(raw[key]) && toStringList(fields[key]).length === 0) {
        throw new NodeOperationError(
          this.getNode(),
          `${label} resolved to an empty list, which would create a key without that restriction. Remove it from the fields to create one on purpose.`,
          { itemIndex },
        );
      }
    }
    const body: IDataObject = {
      name: requireText(this, 'keyName', 'API key name', itemIndex),
      ...collectApiKeyFields.call(
        this,
        fields,
        'Give it a value, or remove it from the fields to create the key without it.',
        itemIndex,
      ),
    };
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
        LEAVE_UNCHANGED,
        itemIndex,
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
 * Maps the shared optional-fields collection onto the DTO. The three list fields
 * arrive as plain strings (comma-separated or a JSON array) or as an expression's
 * array, and are normalised here; an empty list is dropped rather than sent, so it
 * never silently clears a whitelist.
 */
function collectApiKeyFields(
  this: IExecuteFunctions,
  fields: IDataObject,
  remedy: string,
  itemIndex: number,
): IDataObject {
  assertFieldsResolved(
    this,
    fields,
    {
      allowedChats: 'Allowed Chats',
      allowedIps: 'Allowed IPs',
      allowedSessions: 'Allowed Sessions',
      expiresAt: 'Expires At',
      name: 'Name',
      role: 'Role',
    },
    remedy,
    itemIndex,
  );
  const body: IDataObject = {};
  // Refused when blank rather than dropped: dropping it reported a rename that
  // never happened as a success.
  const name = optionalNonBlank(this, fields.name as string | undefined, 'Name', itemIndex);
  if (name !== undefined) {
    body.name = name;
  }
  const role = asText(fields.role, 'Role');
  if (role) {
    body.role = role;
  }
  // The DTO takes an ISO-8601 string, but a dateTime field driven by an expression
  // resolves to whatever that expression returned, which is routinely a Date or
  // epoch-ms. Requiring a string dropped both without a word, creating a key that
  // never expires when one with an expiry was asked for.
  if (fields.expiresAt !== undefined && fields.expiresAt !== null && fields.expiresAt !== '') {
    const expiresAt = toEpochMs(this, fields.expiresAt, 'Expiry date', itemIndex);
    // A century is the ceiling because it is the smallest bound that still catches
    // the mistake this guard exists for. An epoch in MICROseconds is only ~1.79e15,
    // inside the +/-8.64e15 that Date itself accepts, so bounding on Date alone let
    // it through to a year-58648 expiry and an opaque gateway rejection.
    if (!(expiresAt < Date.now() + 100 * 365 * 24 * 60 * 60 * 1000)) {
      throw new NodeOperationError(this.getNode(), 'Expiry date is not a valid date', {
        itemIndex,
      });
    }
    // An instant already past would create a key that is dead on arrival while the
    // request answers 200: the server takes any ISO date here and does not check.
    // Seconds-scale input is the way to arrive here by accident, since it resolves
    // to 1970. Revoke is the operation for retiring a key that already exists.
    if (expiresAt <= Date.now()) {
      throw new NodeOperationError(
        this.getNode(),
        'Expiry date must be in the future. Epoch values are milliseconds, not seconds.',
        { itemIndex },
      );
    }
    body.expiresAt = new Date(expiresAt).toISOString();
  }
  const allowedIps = toStringList(fields.allowedIps);
  if (allowedIps.length > 0) {
    body.allowedIps = allowedIps;
  }
  const allowedSessions = toStringList(fields.allowedSessions);
  if (allowedSessions.length > 0) {
    body.allowedSessions = allowedSessions;
  }
  const allowedChats = toStringList(fields.allowedChats);
  if (allowedChats.length > 0) {
    body.allowedChats = allowedChats;
  }
  return body;
}
