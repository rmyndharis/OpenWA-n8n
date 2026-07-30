import type { IExecuteFunctions } from 'n8n-workflow';
import type { RequestSpec } from './types';
/**
 * Incoming calls. Only rejection is exposed by the API — pair this with the
 * Trigger's `call.received` event to auto-decline calls.
 */
export declare function buildCallRequest(this: IExecuteFunctions, operation: string, itemIndex: number): Promise<RequestSpec | null>;
