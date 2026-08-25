import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { toQueryParams, asText } from './params';
import type { RequestSpec } from './types';

export async function buildSessionRequest(
  this: IExecuteFunctions,
  operation: string,
  itemIndex: number,
): Promise<RequestSpec | null> {
  if (operation === 'create') {
    const body: Record<string, unknown> = {};
    const sessionName = asText(this.getNodeParameter('sessionName', itemIndex));
    if (!sessionName) {
      throw new NodeOperationError(this.getNode(), 'Session name cannot be empty', {
        itemIndex,
      });
    }
    body.name = sessionName;
    const rawConfig = this.getNodeParameter('sessionConfig', itemIndex, '') as
      | string
      | Record<string, unknown>;
    if (rawConfig !== '' && rawConfig !== undefined && rawConfig !== null) {
      let parsedConfig: unknown;
      try {
        parsedConfig = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig;
      } catch {
        throw new NodeOperationError(this.getNode(), 'Session config must be valid JSON', {
          itemIndex,
        });
      }
      if (
        typeof parsedConfig !== 'object' ||
        parsedConfig === null ||
        Array.isArray(parsedConfig)
      ) {
        throw new NodeOperationError(
          this.getNode(),
          'Session config must be a JSON object (e.g. {"autoRejectCalls":true})',
          { itemIndex },
        );
      }
      body.config = parsedConfig;
    }
    // Omit rather than send '': the DTO validates it as a URL, so a blank value is
    // a 400 while an absent key is the documented "no proxy". The scheme is checked
    // here so a typo fails in the editor rather than as a 504 half a minute into a
    // Start that never produces a QR.
    const proxyUrl = asText(this.getNodeParameter('proxyUrl', itemIndex, ''));
    if (proxyUrl) {
      if (!/^(https?|socks[45]):\/\//i.test(proxyUrl)) {
        throw new NodeOperationError(
          this.getNode(),
          'Proxy URL must start with http://, https://, socks4:// or socks5://',
          { itemIndex },
        );
      }
      body.proxyUrl = proxyUrl;
    }
    return { endpoint: '/api/sessions', method: 'POST', body };
  }

  if (operation === 'listAll') {
    const options = this.getNodeParameter('sessionListOptions', itemIndex, {}) as IDataObject;
    return { endpoint: '/api/sessions', method: 'GET', body: {}, qs: toQueryParams(options) };
  }

  if (operation === 'getStatsOverview') {
    return { endpoint: '/api/sessions/stats/overview', method: 'GET', body: {} };
  }

  // Everything below addresses a single session by its UUID id.
  const sessionId = sanitizePathParam(
    this.getNodeParameter('sessionId', itemIndex) as string,
    'Session ID',
  );

  switch (operation) {
    case 'getStatus':
      return { endpoint: `/api/sessions/${sessionId}`, method: 'GET', body: {} };
    case 'start':
      return { endpoint: `/api/sessions/${sessionId}/start`, method: 'POST', body: {} };
    case 'stop':
      return { endpoint: `/api/sessions/${sessionId}/stop`, method: 'POST', body: {} };
    case 'forceKill':
      return { endpoint: `/api/sessions/${sessionId}/force-kill`, method: 'POST', body: {} };
    case 'delete':
      return { endpoint: `/api/sessions/${sessionId}`, method: 'DELETE', body: {} };
    case 'getQr':
      return { endpoint: `/api/sessions/${sessionId}/qr`, method: 'GET', body: {} };
    case 'logout':
      // Unlike Stop, this needs a live engine: it asks WhatsApp to remove this
      // companion device before tearing down locally.
      return { endpoint: `/api/sessions/${sessionId}/logout`, method: 'POST', body: {} };
    case 'getConfig':
      return { endpoint: `/api/sessions/${sessionId}/config`, method: 'GET', body: {} };
    case 'updateConfig': {
      const fields = this.getNodeParameter('sessionConfigFields', itemIndex, {}) as {
        autoRejectCalls?: boolean;
        maxReconnectAttempts?: number;
        reconnectBaseDelay?: number;
      };
      const body: Record<string, unknown> = {};
      // A PATCH merges: an absent key leaves the stored value alone, and an explicit
      // null resets it to the default. An n8n collection cannot express null, which
      // is why the unlimited case needs a sentinel.
      if (fields.autoRejectCalls !== undefined) {
        body.autoRejectCalls = fields.autoRejectCalls;
      }
      if (fields.maxReconnectAttempts !== undefined) {
        // -1 is the node's "back to unlimited" sentinel; the server spells that null,
        // and no in-range number expresses it. 0 is a real value meaning never reconnect.
        // Guard on Number.isFinite so a NaN from an expression cannot serialize to
        // null and silently clear the cap instead of failing.
        const cap = fields.maxReconnectAttempts;
        if (!Number.isFinite(cap)) {
          throw new NodeOperationError(
            this.getNode(),
            'Max Reconnect Attempts must be a number between -1 and 20',
            { itemIndex },
          );
        }
        body.maxReconnectAttempts = cap < 0 ? null : cap;
      }
      if (fields.reconnectBaseDelay !== undefined) {
        body.reconnectBaseDelay = fields.reconnectBaseDelay;
      }
      if (Object.keys(body).length === 0) {
        throw new NodeOperationError(
          this.getNode(),
          'At least one field must be provided to update',
          { itemIndex },
        );
      }
      return { endpoint: `/api/sessions/${sessionId}/config`, method: 'PATCH', body };
    }
    case 'requestPairingCode': {
      const phoneNumber = asText(this.getNodeParameter('pairingPhoneNumber', itemIndex))
        .replace(/[\s+\-()]/g, '');
      if (!/^\d{6,15}$/.test(phoneNumber)) {
        throw new NodeOperationError(
          this.getNode(),
          'Phone number must be 6–15 digits in international format (e.g. 628123456789)',
          { itemIndex },
        );
      }
      return {
        endpoint: `/api/sessions/${sessionId}/pairing-code`,
        method: 'POST',
        body: { phoneNumber },
      };
    }
    default:
      return null;
  }
}
