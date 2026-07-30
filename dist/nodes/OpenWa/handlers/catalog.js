"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCatalogRequest = buildCatalogRequest;
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
const params_1 = require("./params");
/**
 * The WhatsApp Business catalog attached to the session's own account.
 *
 * Sending a catalog or a product card to a chat lives on the Message resource
 * instead — those are message sends and share its Chat ID field.
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
            const productId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('productId', itemIndex), 'Product ID');
            return { endpoint: `${base}/products/${productId}`, method: 'GET', body: {} };
        }
        default:
            return null;
    }
}
//# sourceMappingURL=catalog.js.map