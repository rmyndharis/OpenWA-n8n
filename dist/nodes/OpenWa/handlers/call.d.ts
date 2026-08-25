import type { IExecuteFunctions } from 'n8n-workflow';
import type { RequestSpec } from './types';
/**
 * Calls. Reject declines a ringing call, which pairs with the Trigger's
 * `call.received` event to auto-decline; Create Link produces a shareable
 * WhatsApp call link that anyone can join.
 */
export declare function buildCallRequest(this: IExecuteFunctions, operation: string, itemIndex: number): Promise<RequestSpec | null>;
