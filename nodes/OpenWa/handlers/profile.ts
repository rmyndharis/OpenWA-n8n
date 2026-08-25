import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { resolveMediaSource, type MediaParamNames } from '../media';
import { requireText } from './params';
import type { RequestSpec } from './types';

const PICTURE_MEDIA: MediaParamNames = {
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
export async function buildProfileRequest(
  this: IExecuteFunctions,
  operation: string,
  itemIndex: number,
): Promise<RequestSpec | null> {
  const sessionId = sanitizePathParam(
    this.getNodeParameter('sessionId', itemIndex) as string,
    'Session ID',
  );
  const base = `/api/sessions/${sessionId}/profile`;

  switch (operation) {
    case 'setName':
      return {
        endpoint: `${base}/name`,
        method: 'PUT',
        body: { name: requireText(this, 'profileName', 'Name', itemIndex, MAX_NAME_LENGTH) },
      };
    case 'setStatus': {
      // An empty string is valid here: it clears the about text. Send it as-is
      // rather than dropping the field, which the API would reject as missing.
      const status = (this.getNodeParameter('profileStatus', itemIndex, '') as string).trim();
      if (status.length > MAX_STATUS_LENGTH) {
        throw new NodeOperationError(
          this.getNode(),
          `Status cannot exceed ${MAX_STATUS_LENGTH} characters`,
          { itemIndex },
        );
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
        body: await resolveMediaSource.call(this, itemIndex, PICTURE_MEDIA, 'image/jpeg'),
      };
    default:
      return null;
  }
}
