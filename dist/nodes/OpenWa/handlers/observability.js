"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildObservabilityRequest = buildObservabilityRequest;
/**
 * Server health and metrics, for monitoring and alerting from inside a workflow.
 *
 * Kept apart from the System resource — which writes settings and reads
 * statistics — so a workflow that only wants to know whether the server is up
 * does not sit next to operations that change it. Operation names follow #28.
 *
 * None of these are scoped to a session, so this resource has no Session ID.
 */
async function buildObservabilityRequest(operation, _itemIndex) {
    switch (operation) {
        case 'check':
            return { endpoint: '/api/health', method: 'GET', body: {} };
        case 'checkLiveness':
            return { endpoint: '/api/health/live', method: 'GET', body: {} };
        case 'checkReadiness':
            // Also probes the database connections, so this is the one that reports a
            // server that is running but not yet able to serve.
            return { endpoint: '/api/health/ready', method: 'GET', body: {} };
        // /api/metrics is deliberately absent: it is @Public() on the server and
        // gated on a separate bearer token (`metrics-bearer` in the spec) rather
        // than the X-API-Key this credential carries, so it can only ever answer
        // 404 or 401 from here. Adding it back needs a metrics-token credential
        // field, not just a route.
        default:
            return null;
    }
}
