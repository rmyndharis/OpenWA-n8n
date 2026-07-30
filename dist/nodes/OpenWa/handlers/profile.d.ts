import type { IExecuteFunctions } from 'n8n-workflow';
import type { RequestSpec } from './types';
/**
 * The session's own WhatsApp profile — display name, about/status text, and
 * profile picture.
 */
export declare function buildProfileRequest(this: IExecuteFunctions, operation: string, itemIndex: number): Promise<RequestSpec | null>;
