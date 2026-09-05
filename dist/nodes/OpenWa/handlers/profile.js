"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProfileRequest = buildProfileRequest;
const n8n_workflow_1 = require("n8n-workflow");
const sanitizePathParam_1 = require("../../shared/sanitizePathParam");
const media_1 = require("../media");
const params_1 = require("./params");
const PICTURE_MEDIA = {
    source: 'profilePictureSource',
    binaryProperty: 'profilePictureBinaryProperty',
    url: 'profilePictureUrl',
    base64: 'profilePictureBase64',
    mimeType: 'profilePictureMimeType',
};
// WhatsApp's own limits, mirrored by the server DTOs.
const MAX_NAME_LENGTH = 25;
const MAX_STATUS_LENGTH = 139;
/**
 * The session's own WhatsApp profile — display name, about/status text, and
 * profile picture.
 */
async function buildProfileRequest(operation, itemIndex) {
    const sessionId = (0, sanitizePathParam_1.sanitizePathParam)(this.getNodeParameter('sessionId', itemIndex), 'Session ID');
    const base = `/api/sessions/${sessionId}/profile`;
    switch (operation) {
        case 'setName':
            return {
                endpoint: `${base}/name`,
                method: 'PUT',
                body: { name: (0, params_1.requireText)(this, 'profileName', 'Name', itemIndex, MAX_NAME_LENGTH) },
            };
        case 'setStatus': {
            // An empty string is valid here: it clears the about text. Send it as-is
            // rather than dropping the field, which the API would reject as missing.
            const status = (0, params_1.asText)(this.getNodeParameter('profileStatus', itemIndex, ''));
            if (status.length > MAX_STATUS_LENGTH) {
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Status cannot exceed ${MAX_STATUS_LENGTH} characters`, { itemIndex });
            }
            return { endpoint: `${base}/status`, method: 'PUT', body: { status } };
        }
        case 'deletePicture': {
            return { endpoint: `${base}/picture`, method: 'DELETE', body: {} };
        }
        case 'setPicture':
            return {
                endpoint: `${base}/picture`,
                method: 'PUT',
                body: await media_1.resolveMediaSource.call(this, itemIndex, PICTURE_MEDIA, 'image/jpeg'),
            };
        default:
            return null;
    }
}
