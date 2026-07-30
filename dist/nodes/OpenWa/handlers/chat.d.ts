import type { IExecuteFunctions } from 'n8n-workflow';
import type { RequestSpec } from './types';
/**
 * Chat-level operations. These live under the session routes on the server
 * (`/api/sessions/:id/chats/...`) but are their own resource in the node,
 * because they act on a conversation rather than on the session itself.
 */
export declare function buildChatRequest(this: IExecuteFunctions, operation: string, itemIndex: number): Promise<RequestSpec | null>;
