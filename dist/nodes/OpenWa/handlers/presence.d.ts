import type { IExecuteFunctions } from 'n8n-workflow';
import type { RequestSpec } from './types';
/**
 * Presence: who is online, typing, or last seen.
 *
 * Every operation here is connection-scoped. A subscription lives on the socket,
 * so a restart, a Stop/Start, or any automatic reconnect ends it, and nothing on
 * the server re-issues it. The same is true of the account's own presence. Drive
 * both from the Trigger's `session.status` event reaching `ready` rather than once
 * at workflow start.
 */
export declare function buildPresenceRequest(this: IExecuteFunctions, operation: string, itemIndex: number): Promise<RequestSpec | null>;
