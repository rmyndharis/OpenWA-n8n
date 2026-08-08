import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Imports compiled output, so run `npm run build` before this test.
import { WEBHOOK_EVENT_VALUES } from '../dist/nodes/shared/webhookEvents.js';
import * as actionModule from '../dist/nodes/OpenWa/OpenWa.node.js';
import * as triggerModule from '../dist/nodes/OpenWaTrigger/OpenWaTrigger.node.js';

const { OpenWa } = actionModule;
const { OpenWaTrigger } = triggerModule;

// A SNAPSHOT of core's WEBHOOK_EVENTS, copied by hand — this repo ships as its own npm package and
// cannot import from the gateway at test time. Treat it as data with a provenance, not as a live
// mirror: nothing here can detect that core has moved.
//
//   source: src/modules/webhook/dto/webhook.dto.ts in rmyndharis/OpenWA
//   taken at: 42deab69 (v0.14.5), 2026-08-08
//   count: 22
//
// The previous copy claimed to "mirror" core and had drifted to 17 while asserting the node matched
// it — so both sides were wrong together and this file stayed green. When core adds an event, update
// this snapshot AND the provenance line above, then add it to nodes/shared/webhookEvents.ts.
const CORE_WEBHOOK_EVENTS_SNAPSHOT = [
  'call.accepted',
  'call.missed',
  'call.received',
  'call.rejected',
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
  'presence.update',
  'session.authenticated',
  'session.disconnected',
  'session.qr',
  'session.reconnect_loop',
  'session.restriction',
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

test('the snapshot is the size the provenance comment claims', () => {
  // Cheap tripwire for the failure this file already had once: a copy that lost entries while every
  // other assertion kept passing, because they all compare against the copy.
  assert.equal(CORE_WEBHOOK_EVENTS_SNAPSHOT.length, 22);
  assert.equal(new Set(CORE_WEBHOOK_EVENTS_SNAPSHOT).size, 22, 'snapshot has duplicates');
});

test('the shared WEBHOOK_EVENT_VALUES list matches the core catalog snapshot', () => {
  assert.deepEqual([...WEBHOOK_EVENT_VALUES].sort(), [...CORE_WEBHOOK_EVENTS_SNAPSHOT].sort());
});

test('the Trigger node surfaces exactly the core event catalog', () => {
  const trigger = new OpenWaTrigger();
  const lists = collectEventValues(trigger.description.properties);
  assert.ok(lists.length >= 1, 'Trigger node has no events parameter');
  for (const values of lists) {
    assert.deepEqual([...values].sort(), [...CORE_WEBHOOK_EVENTS_SNAPSHOT].sort());
  }
});

test('the action node surfaces exactly the core event catalog on Webhook Create and Update', () => {
  const action = new OpenWa();
  const lists = collectEventValues(action.description.properties);
  // Create + Update each declare an `events` parameter.
  assert.ok(lists.length >= 2, `expected ≥2 events parameters (Create + Update), found ${lists.length}`);
  for (const values of lists) {
    assert.deepEqual([...values].sort(), [...CORE_WEBHOOK_EVENTS_SNAPSHOT].sort());
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

// The README's Trigger table is what a user reads before choosing events, and it is the copy that
// drifted furthest — it listed 13 while the node offered 17 and core dispatched 22, and labelled three
// live events "reserved: not yet emitted". Nothing pointed the three at each other, so each could rot
// alone. This closes the last edge of that triangle.
test('the README Trigger table lists exactly the events the node offers', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const documented = [...readme.matchAll(/^\| `([a-z]+\.[a-z_]+)`\s*\|/gm)].map((m) => m[1]);
  assert.deepEqual([...new Set(documented)].sort(), [...CORE_WEBHOOK_EVENTS_SNAPSHOT].sort());
});

test('the README carries no stale "reserved / not yet emitted" label', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.doesNotMatch(readme, /reserved: (accepted on subscribe but )?not yet emitted/i);
});

// The minimum-server claim lives in two places — a shields.io badge and the Compatibility prose — and
// they drifted apart from reality together (both said 0.4.0 while the node had come to call routes
// that arrived in 0.10.9). Bind them to each other so at least a half-update cannot pass.
test('the README states one minimum server version, in both places', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const badge = readme.match(/badge\/OpenWA-%E2%89%A5%20([0-9.]+)-/);
  const prose = readme.match(/Requires an OpenWA server \*\*≥ ([0-9.]+)\*\*/);
  assert.ok(badge, 'no OpenWA version badge found');
  assert.ok(prose, 'no "Requires an OpenWA server" line found');
  assert.equal(badge[1], prose[1]);
});
