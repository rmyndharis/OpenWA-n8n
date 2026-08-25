import type { IExecuteFunctions } from 'n8n-workflow';
import type { RequestSpec } from './types';
/**
 * The WhatsApp Business catalog attached to the account.
 *
 * Baileys only: whatsapp-web.js answers 501 on every route here, because the
 * library parses inbound product messages but exposes no catalog reads. These
 * exist mainly to find the product id that Message > Send Product needs.
 */
export declare function buildCatalogRequest(this: IExecuteFunctions, operation: string, itemIndex: number): Promise<RequestSpec | null>;
