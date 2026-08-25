import type { IExecuteFunctions } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import { toEpochMs } from './params';
import type { RequestSpec } from './types';

/**
 * Calls. Reject declines a ringing call, which pairs with the Trigger's
 * `call.received` event to auto-decline; Create Link produces a shareable
 * WhatsApp call link that anyone can join.
 */
export async function buildCallRequest(
  this: IExecuteFunctions,
  operation: string,
  itemIndex: number,
): Promise<RequestSpec | null> {
  const sessionId = sanitizePathParam(
    this.getNodeParameter('sessionId', itemIndex) as string,
    'Session ID',
  );
  const base = `/api/sessions/${sessionId}/calls`;

  switch (operation) {
    case 'reject': {
      const callId = sanitizePathParam(
        this.getNodeParameter('callId', itemIndex) as string,
        'Call ID',
      );
      return { endpoint: `${base}/${callId}/reject`, method: 'POST', body: {} };
    }
    case 'createLink': {
      const raw = this.getNodeParameter('callLinkStartTime', itemIndex, '') as string;
      // Both fields are required by the DTO. "Now" is the ordinary case, so a blank
      // picker means now rather than an omitted key, which would be a 400.
      const startTime =
        raw === '' || raw === undefined || raw === null
          ? Date.now()
          : toEpochMs(this, raw, 'Start time', itemIndex);
      return {
        endpoint: `${base}/link`,
        method: 'POST',
        body: {
          type: this.getNodeParameter('callLinkType', itemIndex, 'video') as string,
          startTime,
        },
      };
    }
    default:
      return null;
  }
}
