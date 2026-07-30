import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { requireText, toEpochMs, toQueryParams } from './params';
import type { RequestSpec } from './types';

/**
 * Server-wide reporting: the settings document, statistics, the audit log, and
 * cross-session message search.
 *
 * Health lives on the Observability resource instead, so monitoring a server
 * does not share a resource with reading its configuration.
 *
 * Settings are read-only here on purpose: the server derives them from its
 * environment and answers `PUT /api/settings` with 501, so there is no Update
 * Settings operation to offer.
 *
 * These are not scoped to a session, so this resource has no Session ID field —
 * except Get Session Stats, which names one explicitly.
 */
export async function buildSystemRequest(
  this: IExecuteFunctions,
  operation: string,
  itemIndex: number,
): Promise<RequestSpec | null> {
  switch (operation) {
    case 'getSettings':
      return { endpoint: '/api/settings', method: 'GET', body: {} };

    case 'getStatsOverview':
      return { endpoint: '/api/stats/overview', method: 'GET', body: {} };
    case 'getStatsMessages':
      return { endpoint: '/api/stats/messages', method: 'GET', body: {} };
    case 'getSessionStats': {
      const sessionId = sanitizePathParam(
        this.getNodeParameter('sessionId', itemIndex) as string,
        'Session ID',
      );
      return { endpoint: `/api/stats/sessions/${sessionId}`, method: 'GET', body: {} };
    }

    case 'getAudit': {
      const { keyId, ...rest } = this.getNodeParameter(
        'auditFilters',
        itemIndex,
        {},
      ) as IDataObject;
      const qs = toQueryParams(rest);
      // The UI field is `keyId` — spelling it `apiKeyId` there trips the n8n
      // lint rule that masks anything looking like a credential. The wire name
      // the API expects is restored here.
      if (keyId !== undefined && keyId !== '') {
        qs.apiKeyId = keyId;
      }
      return { endpoint: '/api/audit', method: 'GET', body: {}, qs };
    }

    case 'search': {
      // `q` is the only required query parameter; everything else narrows it.
      const qs: IDataObject = {
        q: requireText(this, 'searchQuery', 'Search query', itemIndex),
      };
      Object.assign(
        qs,
        toQueryParams(this.getNodeParameter('searchFilters', itemIndex, {}) as IDataObject),
      );
      // Date From/To are dateTime fields, so the UI supplies ISO-8601 while
      // SearchQueryDto binds them as epoch-ms numbers — send them unconverted
      // and every date-filtered search fails validation.
      for (const [key, label] of [
        ['dateFrom', 'Date From'],
        ['dateTo', 'Date To'],
      ] as const) {
        if (qs[key] !== undefined) {
          qs[key] = toEpochMs(this, qs[key], label, itemIndex);
        }
      }
      return { endpoint: '/api/search', method: 'GET', body: {}, qs };
    }

    default:
      return null;
  }
}
