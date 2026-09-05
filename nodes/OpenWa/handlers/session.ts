import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { parseJsonParam } from '../../shared/jsonParam';
import { toQueryParams, asText } from './params';
import type { RequestSpec } from './types';

/** Ceiling both proxy DTOs place on the URL (`@MaxLength(255)` on create and on PATCH). */
const MAX_PROXY_URL_LENGTH = 255;

/**
 * Refuses a proxy URL the server's `@IsUrl` would reject, so a typo fails in the
 * editor rather than as a 504 half a minute into a Start that never produces a QR.
 * Deliberately looser than the server on the host itself: `require_tld: false` and
 * `allow_underscores: true` there admit single-label container names and IP
 * literals, so only the scheme, the presence of a host, and the length are checked.
 */
function assertProxyUrl(this: IExecuteFunctions, proxyUrl: string, itemIndex: number): void {
  const scheme = /^(https?|socks[45]):\/\/(.*)$/i.exec(proxyUrl);
  if (!scheme) {
    throw new NodeOperationError(
      this.getNode(),
      'Proxy URL must start with http://, https://, socks4:// or socks5://',
      { itemIndex },
    );
  }
  // `socks5://` on its own clears the scheme test but is not a URL; so is a
  // credentials-only form. Take the authority and strip any `user:pass@`.
  const authority = scheme[2].split(/[/?#]/)[0];
  const host = authority.slice(authority.lastIndexOf('@') + 1);
  if (!host) {
    throw new NodeOperationError(this.getNode(), 'Proxy URL must include a host', { itemIndex });
  }
  if (proxyUrl.length > MAX_PROXY_URL_LENGTH) {
    throw new NodeOperationError(
      this.getNode(),
      `Proxy URL cannot exceed ${MAX_PROXY_URL_LENGTH} characters`,
      { itemIndex },
    );
  }
}

export async function buildSessionRequest(
  this: IExecuteFunctions,
  operation: string,
  itemIndex: number,
): Promise<RequestSpec | null> {
  if (operation === 'create') {
    const body: Record<string, unknown> = {};
    const sessionName = asText(this.getNodeParameter('sessionName', itemIndex), 'Session name');
    if (!sessionName) {
      throw new NodeOperationError(this.getNode(), 'Session name cannot be empty', {
        itemIndex,
      });
    }
    body.name = sessionName;
    let parsedConfig: unknown;
    try {
      parsedConfig = parseJsonParam(this.getNodeParameter('sessionConfig', itemIndex, ''));
    } catch {
      throw new NodeOperationError(this.getNode(), 'Session config must be valid JSON', {
        itemIndex,
      });
    }
    if (parsedConfig !== undefined) {
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
    // a 400 while an absent key is the documented "no proxy".
    const proxyUrl = asText(this.getNodeParameter('proxyUrl', itemIndex, ''), 'Proxy URL');
    if (proxyUrl) {
      assertProxyUrl.call(this, proxyUrl, itemIndex);
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
    case 'getProxy':
      // Credentials are never returned: the response reports the scheme, the
      // host:port and whether a username/password is embedded, nothing more.
      return { endpoint: `/api/sessions/${sessionId}/proxy`, method: 'GET', body: {} };
    case 'updateProxy': {
      // Three states on the wire, and only one of them is a string. An absent key
      // re-reads the stored proxy unchanged, an explicit null clears it, and a URL
      // sets it. A text field cannot express null, so clearing gets its own toggle.
      // Compared against true rather than read for truthiness: this one toggle
      // DELETES stored configuration, and an expression resolving to the string
      // 'false' is truthy, which would wipe a working proxy on a value that reads
      // as a refusal.
      if (this.getNodeParameter('proxyClear', itemIndex, false) === true) {
        return {
          endpoint: `/api/sessions/${sessionId}/proxy`,
          method: 'PATCH',
          body: { proxyUrl: null },
        };
      }
      const proxyUrl = asText(this.getNodeParameter('proxyUrl', itemIndex, ''), 'Proxy URL');
      if (!proxyUrl) {
        // An empty body would be dropped before the request is sent, turning the
        // PATCH into a no-op read that reports the old proxy as if it were written.
        throw new NodeOperationError(
          this.getNode(),
          'Proxy URL cannot be empty. Turn on Clear Proxy to remove the stored proxy instead.',
          { itemIndex },
        );
      }
      assertProxyUrl.call(this, proxyUrl, itemIndex);
      return {
        endpoint: `/api/sessions/${sessionId}/proxy`,
        method: 'PATCH',
        body: { proxyUrl },
      };
    }
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
        // Coerced first because the server's own DTO takes a numeric string, and
        // because comparing a raw string against 0 below would read Number('') and
        // Number(null) as the real value 0 rather than as missing input.
        const text = asText(fields.maxReconnectAttempts);
        const cap = text === '' ? Number.NaN : Number(text);
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
      const phoneNumber = asText(
        this.getNodeParameter('pairingPhoneNumber', itemIndex),
        'Phone number',
      ).replace(/[\s+\-()]/g, '');
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
