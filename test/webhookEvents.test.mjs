import test from 'node:test';
import assert from 'node:assert/strict';

// Imports compiled output, so run `npm run build` before this test.
import { WEBHOOK_EVENT_VALUES } from '../dist/nodes/shared/webhookEvents.js';
import * as actionModule from '../dist/nodes/OpenWa/OpenWa.node.js';
import * as triggerModule from '../dist/nodes/OpenWaTrigger/OpenWaTrigger.node.js';

const { OpenWa } = actionModule;
const { OpenWaTrigger } = triggerModule;

// The events OpenWA core actually dispatches (mirrors
// src/modules/webhook/dto/webhook.dto.ts WEBHOOK_EVENTS in the OpenWA repo).
// When core adds an event, add it to nodes/shared/webhookEvents.ts; this test
// then enforces that both nodes surface it — closing the drift that caused
// group.* events to be mislabeled "reserved" and four events to be unselectable.
const CORE_WEBHOOK_EVENTS = [
  'call.received',
  'group.join',
  'group.leave',
  'group.update',
  'message.ack',
  'message.edited',
  'message.failed',
  'message.reaction',
  'message.received',
  'message.revoked',
  'message.sent',
  'session.authenticated',
  'session.disconnected',
  'session.qr',
  'session.reconnect_loop',
  'session.status',
  'status.received',
];

// Collect every `events` multiOptions parameter's value list from a node's
// full properties tree (including nested updateFields collections).
function collectEventValues(properties) {
  const out = [];
  for (const p of properties) {
    if (p.name === 'events' && p.type === 'multiOptions' && Array.isArray(p.options)) {
      out.push(p.options.map((o) => o.value));
    }
    // Webhook Update nests its fields under an `updateFields` collection.
    if (p.type === 'collection' && Array.isArray(p.options)) {
      for (const sub of p.options) {
        if (sub.name === 'events' && sub.type === 'multiOptions' && Array.isArray(sub.options)) {
          out.push(sub.options.map((o) => o.value));
        }
      }
    }
  }
  return out;
}

test('the shared WEBHOOK_EVENT_VALUES list matches the core catalog', () => {
  assert.deepEqual([...WEBHOOK_EVENT_VALUES].sort(), [...CORE_WEBHOOK_EVENTS].sort());
});

test('the Trigger node surfaces exactly the core event catalog', () => {
  const trigger = new OpenWaTrigger();
  const lists = collectEventValues(trigger.description.properties);
  assert.ok(lists.length >= 1, 'Trigger node has no events parameter');
  for (const values of lists) {
    assert.deepEqual([...values].sort(), [...CORE_WEBHOOK_EVENTS].sort());
  }
});

test('the action node surfaces exactly the core event catalog on Webhook Create and Update', () => {
  const action = new OpenWa();
  const lists = collectEventValues(action.description.properties);
  // Create + Update each declare an `events` parameter.
  assert.ok(lists.length >= 2, `expected ≥2 events parameters (Create + Update), found ${lists.length}`);
  for (const values of lists) {
    assert.deepEqual([...values].sort(), [...CORE_WEBHOOK_EVENTS].sort());
  }
});

test('no event option carries the stale "Reserved" / "never fires" wording', () => {
  for (const Module of [OpenWa, OpenWaTrigger]) {
    const node = new Module();
    for (const p of node.description.properties) {
      const opts = p.type === 'collection' ? (p.options ?? []) : p.type === 'multiOptions' ? [p] : [];
      for (const o of opts) {
        if (o.name === 'events' && Array.isArray(o.options)) {
          for (const opt of o.options) {
            assert.match(opt.name ?? '', /^((?!Reserved).)*$/);
            assert.doesNotMatch(opt.description ?? '', /never fires/i);
          }
        }
      }
    }
  }
});
