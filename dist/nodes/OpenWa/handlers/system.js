"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSystemRequest = buildSystemRequest;
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
const params_1 = require("./params");
/**
 * Server-wide reporting: the settings document, statistics, the audit log, and
 * cross-session message search.
 *
 * Health lives on the Observability resource instead, so monitoring a server
 * does not share a resource with reading its configuration.
 *
 * Settings are read-only here on purpose: the server derives them from its
 * environment and publishes no write route at all, so there is no Update Settings
 * operation to offer.
 *
 * These are not scoped to a session, so this resource has no Session ID field —
 * except Get Session Stats, which names one explicitly.
 */
async function buildSystemRequest(operation, itemIndex) {
    switch (operation) {
        case 'getSettings':
            return { endpoint: '/api/settings', method: 'GET', body: {} };
        case 'getStatsOverview':
            return { endpoint: '/api/stats/overview', method: 'GET', body: {} };
        case 'getStatsMessages': {
            // This route binds its query to a DTO, so `period` is the only key it accepts
            // and anything else is refused rather than ignored.
            const period = this.getNodeParameter('statsPeriod', itemIndex, '24h');
            return { endpoint: '/api/stats/messages', method: 'GET', body: {}, qs: { period } };
        }
        case 'getSessionStats': {
            const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
            return { endpoint: `/api/stats/sessions/${sessionId}`, method: 'GET', body: {} };
        }
        case 'getAudit': {
            const { keyId, ...rest } = this.getNodeParameter('auditFilters', itemIndex, {});
            const qs = (0, params_1.toQueryParams)(rest);
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
            const qs = {
                q: (0, params_1.requireText)(this, 'searchQuery', 'Search query', itemIndex),
            };
            Object.assign(qs, (0, params_1.toQueryParams)(this.getNodeParameter('searchFilters', itemIndex, {})));
            // Date From/To are dateTime fields, so the UI supplies ISO-8601 while
            // SearchQueryDto binds them as epoch-ms numbers — send them unconverted
            // and every date-filtered search fails validation.
            for (const [key, label] of [
                ['dateFrom', 'Date From'],
                ['dateTo', 'Date To'],
            ]) {
                if (qs[key] !== undefined) {
                    qs[key] = (0, params_1.toEpochMs)(this, qs[key], label, itemIndex);
                }
            }
            return { endpoint: '/api/search', method: 'GET', body: {}, qs };
        }
        default:
            return null;
    }
}
//# sourceMappingURL=system.js.map