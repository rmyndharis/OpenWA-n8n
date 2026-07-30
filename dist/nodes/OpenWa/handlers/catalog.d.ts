import type { IExecuteFunctions } from 'n8n-workflow';
import type { RequestSpec } from './types';
/**
 * The WhatsApp Business catalog attached to the session's own account.
 *
 * Sending a catalog or a product card to a chat lives on the Message resource
 * instead — those are message sends and share its Chat ID field.
 */
export declare function buildCatalogRequest(this: IExecuteFunctions, operation: string, itemIndex: number): Promise<RequestSpec | null>;
