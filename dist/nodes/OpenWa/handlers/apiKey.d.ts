import type { IExecuteFunctions } from 'n8n-workflow';
import type { RequestSpec } from './types';
/**
 * API-key administration.
 *
 * The credential used to call these must itself be an admin key. Create returns
 * the new key's plaintext exactly once — capture it in the same execution,
 * because it cannot be read back afterwards.
 */
export declare function buildApiKeyRequest(this: IExecuteFunctions, operation: string, itemIndex: number): Promise<RequestSpec | null>;
