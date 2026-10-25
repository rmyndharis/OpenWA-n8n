import type { IExecuteFunctions } from 'n8n-workflow';
import type { RequestSpec } from './types';
/**
 * Presence: who is online, typing, or last seen.
 *
 * Every operation here is connection-scoped. A subscription lives on the socket,
 * so a restart, a Stop/Start, or any automatic reconnect ends it, and nothing on
 * the server re-issues it. The account's own presence is re-applied by servers
 * from 0.24.0 when the same engine reconnects, and lost when the engine is
 * replaced (or on any reconnect before 0.24.0). Drive both from the Trigger's
 * `session.status` event reaching `ready` rather than once at workflow start.
 */
export declare function buildPresenceRequest(this: IExecuteFunctions, operation: string, itemIndex: number): Promise<RequestSpec | null>;
