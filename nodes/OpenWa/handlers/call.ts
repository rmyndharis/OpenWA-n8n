import type { IExecuteFunctions } from 'n8n-workflow';
import { sanitizePathParam } from '../../shared/sanitizePathParam';
import type { RequestSpec } from './types';

/**
 * Incoming calls. Only rejection is exposed by the API — pair this with the
 * Trigger's `call.received` event to auto-decline calls.
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
