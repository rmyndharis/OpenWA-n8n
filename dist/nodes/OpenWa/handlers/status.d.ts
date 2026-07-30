import type { IExecuteFunctions } from 'n8n-workflow';
import type { RequestSpec } from './types';
/**
 * WhatsApp Status (stories) — reading the status feed and posting text, image,
 * or video updates.
 */
export declare function buildStatusRequest(this: IExecuteFunctions, operation: string, itemIndex: number): Promise<RequestSpec | null>;
