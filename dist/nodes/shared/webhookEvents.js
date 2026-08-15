"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEBHOOK_EVENT_VALUES = exports.WEBHOOK_EVENT_OPTIONS = void 0;
exports.WEBHOOK_EVENT_OPTIONS = [
    {
        name: 'Call Accepted',
        value: 'call.accepted',
        description: 'Triggers when an incoming call is answered. Baileys only — whatsapp-web.js sees the ring but never its outcome.',
    },
    {
        name: 'Call Missed',
        value: 'call.missed',
        description: 'Triggers when an incoming call goes unanswered. Baileys only — whatsapp-web.js sees the ring but never its outcome.',
    },
    {
        name: 'Call Received',
        value: 'call.received',
        description: 'Triggers when an incoming WhatsApp call is detected',
    },
    {
        name: 'Call Rejected',
        value: 'call.rejected',
        description: 'Triggers when an incoming call is declined, including by auto-reject. Baileys only — whatsapp-web.js sees the ring but never its outcome.',
    },
    {
        name: 'Group Join',
        value: 'group.join',
        description: 'Triggers when a participant joins a group the session belongs to',
    },
    {
        name: 'Group Join Request',
        value: 'group.join_request',
        description: 'Triggers when someone asks to join a group the session administers (server ≥ 0.15.0; the queue is readable and actionable via the group membership-request routes)',
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
        name: 'Presence Update',
        value: 'presence.update',
        description: "Triggers when a subscribed chat's presence changes. Requires POST /presence/subscribe first, and Baileys — whatsapp-web.js cannot observe presence and answers 501.",
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
        description: 'Triggers when a session is stuck in a reconnect loop (once per 5 consecutive attempts; OpenWA ≥ 0.10.0)',
    },
    {
        name: 'Session Restriction',
        value: 'session.restriction',
        description: 'Triggers when WhatsApp places or lifts a restriction on the account',
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
exports.WEBHOOK_EVENT_VALUES = exports.WEBHOOK_EVENT_OPTIONS.map((o) => o.value);
//# sourceMappingURL=webhookEvents.js.map