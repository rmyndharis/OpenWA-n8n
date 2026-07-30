import type { IExecuteFunctions } from 'n8n-workflow';
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
export declare function buildSystemRequest(this: IExecuteFunctions, operation: string, itemIndex: number): Promise<RequestSpec | null>;
