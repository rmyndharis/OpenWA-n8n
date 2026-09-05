"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCatalogRequest = buildCatalogRequest;
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
const params_1 = require("./params");
/**
 * The WhatsApp Business catalog attached to the account.
 *
 * Baileys only: whatsapp-web.js answers 501 on every route here, because the
 * library parses inbound product messages but exposes no catalog reads. These
 * exist mainly to find the product id that Message > Send Product needs.
 */
async function buildCatalogRequest(operation, itemIndex) {
    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
    const base = `/api/sessions/${sessionId}/catalog`;
    switch (operation) {
        case 'get':
            return { endpoint: base, method: 'GET', body: {} };
        case 'listProducts': {
            const options = this.getNodeParameter('catalogListOptions', itemIndex, {});
            return { endpoint: `${base}/products`, method: 'GET', body: {}, qs: (0, params_1.toQueryParams)(options) };
        }
        case 'getProduct': {
            const productId = (0, params_1.requireText)(this, 'productId', 'Product ID', itemIndex);
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
