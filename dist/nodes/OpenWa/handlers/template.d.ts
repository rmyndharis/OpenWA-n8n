import type { IExecuteFunctions } from 'n8n-workflow';
import type { RequestSpec } from './types';
/**
 * Reusable message templates with `{{variable}}` placeholders, stored per
 * session and rendered by Message → Send Template.
 */
export declare function buildTemplateRequest(this: IExecuteFunctions, operation: string, itemIndex: number): Promise<RequestSpec | null>;
