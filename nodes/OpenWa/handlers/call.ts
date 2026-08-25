import type { IExecuteFunctions } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import type { RequestSpec } from './types';

/**
 * Incoming calls. Rejection is the operation offered here; pair it with the
 * Trigger's `call.received` event to auto-decline calls. The server also
 * publishes a shareable call link route, which this resource does not yet cover.
 */
export async function buildCallRequest(
  this: IExecuteFunctions,
  operation: string,
  itemIndex: number,
): Promise<RequestSpec | null> {
  if (operation !== 'reject') {
    return null;
  }
  const sessionId = sanitizePathParam(
    this.getNodeParameter('sessionId', itemIndex) as string,
    'Session ID',
  );
  const callId = sanitizePathParam(this.getNodeParameter('callId', itemIndex) as string, 'Call ID');
  return {
    endpoint: `/api/sessions/${sessionId}/calls/${callId}/reject`,
    method: 'POST',
    body: {},
  };
}
