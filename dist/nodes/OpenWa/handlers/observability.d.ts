import type { IExecuteFunctions } from 'n8n-workflow';
import type { RequestSpec } from './types';
/**
 * Server health and metrics, for monitoring and alerting from inside a workflow.
 *
 * Kept apart from the System resource — which writes settings and reads
 * statistics — so a workflow that only wants to know whether the server is up
 * does not sit next to operations that change it. Operation names follow #28.
 *
 * None of these are scoped to a session, so this resource has no Session ID.
 */
export declare function buildObservabilityRequest(this: IExecuteFunctions, operation: string, _itemIndex: number): Promise<RequestSpec | null>;
