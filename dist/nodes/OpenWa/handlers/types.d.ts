import type { IHttpRequestMethods } from 'n8n-workflow';
/**
 * A fully-resolved OpenWA API request for one input item. Builders return null
 * for an operation they do not handle; the executor turns that into an
 * "unsupported resource/operation" error.
 */
export interface RequestSpec {
    endpoint: string;
    method: IHttpRequestMethods;
    body: Record<string, unknown>;
}
