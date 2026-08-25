import type { IExecuteFunctions } from 'n8n-workflow';
import type { RequestSpec } from './types';
/**
 * Incoming calls. Rejection is the operation offered here; pair it with the
 * Trigger's `call.received` event to auto-decline calls. The server also
 * publishes a shareable call link route, which this resource does not yet cover.
 */
export declare function buildCallRequest(this: IExecuteFunctions, operation: string, itemIndex: number): Promise<RequestSpec | null>;
