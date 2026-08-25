import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { requireText, toQueryParams } from './params';
import type { RequestSpec } from './types';

/**
 * The WhatsApp Business catalog attached to the account.
 *
 * Baileys only: whatsapp-web.js answers 501 on every route here, because the
 * library parses inbound product messages but exposes no catalog reads. These
 * exist mainly to find the product id that Message > Send Product needs.
 */
export async function buildCatalogRequest(
  this: IExecuteFunctions,
  operation: string,
  itemIndex: number,
): Promise<RequestSpec | null> {
  const sessionId = sanitizePathParam(
    this.getNodeParameter('sessionId', itemIndex) as string,
    'Session ID',
  );
  const base = `/api/sessions/${sessionId}/catalog`;

  switch (operation) {
    case 'get':
      return { endpoint: base, method: 'GET', body: {} };
    case 'listProducts': {
      const options = this.getNodeParameter('catalogListOptions', itemIndex, {}) as IDataObject;
      return { endpoint: `${base}/products`, method: 'GET', body: {}, qs: toQueryParams(options) };
    }
    case 'getProduct': {
      const productId = requireText(this, 'productId', 'Product ID', itemIndex);
      return {
        endpoint: `${base}/products/${encodeURIComponent(productId)}`,
        method: 'GET',
        body: {},
      };
    }
    default:
      return null;
  }
}
