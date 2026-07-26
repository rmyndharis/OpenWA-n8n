/**
 * The webhook events OpenWA dispatches, as n8n `multiOptions` entries.
 *
 * This mirrors `WEBHOOK_EVENTS` in the OpenWA core repo
 * (`src/modules/webhook/dto/webhook.dto.ts`). It is the single source of truth for
 * the node's event option lists — both the Trigger node's `events` parameter and
 * the action node's Webhook Create/Update `events` parameters read from it, so
 * the three cannot drift apart. When core adds an event, add it here once.
 *
 * Order is alphabetical-by-value to keep the diff stable as events are added.
 */
import type {INodeProperties} from 'n8n-workflow';

export const WEBHOOK_EVENT_OPTIONS: INodeProperties['options'] = [
  {
    name: 'Call Received',
    value: 'call.received',
    description: 'Triggers when an incoming WhatsApp call is detected',
  },
  {
    name: 'Group Join',
    value: 'group.join',
    description: 'Triggers when a participant joins a group the session belongs to',
  },
  {
    name: 'Group Leave',
    value: 'group.leave',
    description: 'Triggers when a participant leaves a group the session belongs to',
  },
  {
    name: 'Group Update',
    value: 'group.update',
    description: "Triggers when a group's metadata or participant roster changes",
  },
  {
    name: 'Message Ack',
    value: 'message.ack',
    description: 'Triggers on a message delivery or read acknowledgement',
  },
  {
    name: 'Message Edited',
    value: 'message.edited',
    description: "Triggers when a message's text or media is edited",
  },
  {
    name: 'Message Failed',
    value: 'message.failed',
    description: 'Triggers when a message fails to send',
  },
  {
    name: 'Message Reaction',
    value: 'message.reaction',
    description: 'Triggers when a reaction is added to or removed from a message',
  },
  {
    name: 'Message Received',
    value: 'message.received',
    description: 'Triggers when a new message is received',
  },
  {
    name: 'Message Revoked',
    value: 'message.revoked',
    description: 'Triggers when a message is deleted for everyone',
  },
  {
    name: 'Message Sent',
    value: 'message.sent',
    description: 'Triggers when a message is sent successfully',
  },
  {
    name: 'Session Authenticated',
    value: 'session.authenticated',
    description: 'Triggers when the session is authenticated',
  },
  {
    name: 'Session Disconnected',
    value: 'session.disconnected',
    description: 'Triggers when the session loses connection',
  },
  {
    name: 'Session QR',
    value: 'session.qr',
    description: 'Triggers when a new QR code is generated',
  },
  {
    name: 'Session Reconnect Loop',
    value: 'session.reconnect_loop',
    description:
      'Triggers when a session is stuck in a reconnect loop (once per 5 consecutive attempts; OpenWA ≥ 0.10.0)',
  },
  {
    name: 'Session Status',
    value: 'session.status',
    description: 'Triggers on any session status change',
  },
  {
    name: 'Status Received',
    value: 'status.received',
    description: "Triggers when a contact's Status (Story) is received",
  },
];

/** The event values only, for tests and for configHash seed parity. */
export const WEBHOOK_EVENT_VALUES: string[] = WEBHOOK_EVENT_OPTIONS.map((o) => (o as {value: string}).value);
