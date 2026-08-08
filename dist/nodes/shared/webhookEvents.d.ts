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
 *
 * Some events only ever fire on one engine, because only one adapter produces the callback behind
 * them. Those say so in their description rather than being omitted: they are real OpenWA events, and
 * a user on the other engine is better served by knowing why nothing arrives than by not finding the
 * option at all.
 */
import type { INodeProperties } from 'n8n-workflow';
export declare const WEBHOOK_EVENT_OPTIONS: INodeProperties['options'];
/** The event values only, for tests and for configHash seed parity. */
export declare const WEBHOOK_EVENT_VALUES: string[];
