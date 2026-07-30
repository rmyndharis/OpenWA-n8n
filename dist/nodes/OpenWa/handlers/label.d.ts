import type { IExecuteFunctions } from 'n8n-workflow';
import type { RequestSpec } from './types';
/**
 * WhatsApp Business labels — the catalogue of labels on the account, and the
 * labels attached to an individual chat.
 */
export declare function buildLabelRequest(this: IExecuteFunctions, operation: string, itemIndex: number): Promise<RequestSpec | null>;
