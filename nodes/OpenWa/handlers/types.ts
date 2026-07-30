import type { IDataObject, IHttpRequestMethods } from 'n8n-workflow';

/**
 * A fully-resolved OpenWA API request for one input item. Builders return null
 * for an operation they do not handle; the executor turns that into an
 * "unsupported resource/operation" error.
 */
export interface RequestSpec {
  endpoint: string;
  method: IHttpRequestMethods;
  body: Record<string, unknown>;
  /**
   * Optional query string. Only set by operations that paginate or filter;
   * omitted entirely when empty so GET URLs stay unchanged for every existing
   * operation.
   */
  qs?: IDataObject;
  /**
   * Set to 'text' for the routes that answer with something other than JSON.
   * The executor then skips JSON parsing and wraps the body under `data`, since
   * a bare string is not a valid item `json` value. Only /api/metrics needs it.
   */
  responseFormat?: 'text';
}
