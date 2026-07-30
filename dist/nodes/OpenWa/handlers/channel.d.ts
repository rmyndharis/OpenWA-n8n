import type { IExecuteFunctions } from 'n8n-workflow';
import type { RequestSpec } from './types';
/**
 * WhatsApp Channels (newsletters) the session follows.
 *
 * Note that Unsubscribe is a DELETE on the channel itself — it leaves the
 * channel rather than deleting it, which nobody following it could do.
 */
export declare function buildChannelRequest(this: IExecuteFunctions, operation: string, itemIndex: number): Promise<RequestSpec | null>;
