import type { IExecuteFunctions } from 'n8n-workflow';
import type { RequestSpec } from './types';
/**
 * Autoreply rules: the gateway answers matching inbound messages itself, without
 * a round trip through n8n. Useful for an out-of-hours acknowledgement that must
 * go out even when the workflow is not running.
 */
export declare function buildAutomationRuleRequest(this: IExecuteFunctions, operation: string, itemIndex: number): Promise<RequestSpec | null>;
