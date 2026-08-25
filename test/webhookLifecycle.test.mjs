import test from 'node:test';
import assert from 'node:assert/strict';

// Imports compiled output, so run `npm run build` before this test.
import { httpStatusFromError } from '../dist/nodes/OpenWaTrigger/httpStatus.js';
import { webhookConfigHash } from '../dist/nodes/OpenWaTrigger/configHash.js';
import { stableStringify } from '../dist/nodes/shared/jsonParam.js';
import * as triggerModule from '../dist/nodes/OpenWaTrigger/OpenWaTrigger.node.js';

const { OpenWaTrigger } = triggerModule;

const WEBHOOK_URL = 'https://n8n.example/webhook/test';

// The fingerprint matching the default fake configuration below (no secret,
// one event, session "default"). A different value simulates a changed config.
const CURRENT_HASH = webhookConfigHash({
  url: WEBHOOK_URL,
  events: ['message.received'],
  secret: '',
  sessionId: 'default',
});

// A plain fake `this` for the webhook lifecycle hooks — no n8n mock framework.
// `staticData` is returned by reference so tests can assert what was cleared.
function makeCtx({
  webhookId = 'w1',
  storedSessionId = 'default',
  configHash,
  secret = '',
  events = ['message.received'],
  filters,
  throwErr = null,
  createResponse = { id: 'w1' },
  // What GET /webhooks/:id answers. Defaults to a registration that still matches
  // the configuration below, which is what checkExists must accept as healthy.
  getResponse,
} = {}) {
  const staticData = {};
  if (webhookId !== undefined) staticData.webhookId = webhookId;
  if (storedSessionId !== undefined) staticData.sessionId = storedSessionId;
  if (configHash !== undefined) staticData.configHash = configHash;
  const calls = [];
  const params = { sessionId: 'default', events, webhookSecret: secret };
  if (filters !== undefined) params.filters = filters;
  const ctx = {
    calls,
    getWorkflowStaticData: () => staticData,
    getCredentials: async () => ({ serverUrl: 'http://localhost:2785' }),
    getNode: () => ({ id: 'node-1', name: 'OpenWA Trigger' }),
    // Mirrors n8n: an unset parameter falls back to the supplied default.
    getNodeParameter: (name, fallback) => (name in params ? params[name] : fallback),
    getNodeWebhookUrl: () => WEBHOOK_URL,
    helpers: {
      httpRequestWithAuthentication: async (_cred, options) => {
        calls.push(options);
        if (throwErr) throw throwErr;
        if (options.method === 'GET') {
          return (
            getResponse ?? { id: webhookId, active: true, url: WEBHOOK_URL, events, sessionId: 'default' }
          );
        }
        return createResponse;
      },
    },
  };
  return { ctx, staticData, calls };
}

const hooks = () => new OpenWaTrigger().webhookMethods.default;

// --- httpStatusFromError shape coverage ---
test('httpStatusFromError reads a numeric statusCode', () => {
  assert.equal(httpStatusFromError({ statusCode: 404 }), 404);
});

test('httpStatusFromError reads a NodeApiError string httpCode', () => {
  assert.equal(httpStatusFromError({ httpCode: '404' }), 404);
});

test('httpStatusFromError reads response.status', () => {
  assert.equal(httpStatusFromError({ response: { status: 404 } }), 404);
});

test('httpStatusFromError returns undefined for a status-less error', () => {
  assert.equal(httpStatusFromError(new Error('ECONNREFUSED')), undefined);
});

test('httpStatusFromError preserves a non-404 status', () => {
  assert.equal(httpStatusFromError({ statusCode: 500 }), 500);
});

// --- webhookConfigHash shape coverage ---
test('webhookConfigHash is stable regardless of event order', () => {
  const a = webhookConfigHash({ url: 'u', events: ['a.b', 'c.d'], secret: 's', sessionId: 'x' });
  const b = webhookConfigHash({ url: 'u', events: ['c.d', 'a.b'], secret: 's', sessionId: 'x' });
  assert.equal(a, b);
});

test('webhookConfigHash changes when any registered field changes', () => {
  const base = { url: 'u', events: ['a.b'], secret: 's', sessionId: 'x' };
  const baseHash = webhookConfigHash(base);
  assert.notEqual(webhookConfigHash({ ...base, url: 'v' }), baseHash);
  assert.notEqual(webhookConfigHash({ ...base, events: ['a.b', 'c.d'] }), baseHash);
  assert.notEqual(webhookConfigHash({ ...base, secret: 't' }), baseHash);
  assert.notEqual(webhookConfigHash({ ...base, sessionId: 'y' }), baseHash);
});

// --- delete hook wiring ---
test('delete: an already-gone webhook (404) is swallowed and the id cleared', async () => {
  const { ctx, staticData } = makeCtx({ throwErr: { statusCode: 404 } });
  assert.equal(await hooks().delete.call(ctx), true);
  assert.equal(staticData.webhookId, undefined);
});

test('delete: a non-404 error is rethrown', async () => {
  const { ctx } = makeCtx({ throwErr: { statusCode: 500 } });
  await assert.rejects(() => hooks().delete.call(ctx));
});

test('delete: clears the stored session id and config hash too', async () => {
  const { ctx, staticData } = makeCtx({ configHash: CURRENT_HASH });
  assert.equal(await hooks().delete.call(ctx), true);
  assert.deepEqual(staticData, {});
});

test('delete: targets the STORED session when the parameter has since changed', async () => {
  // The webhook was registered on "old-session"; the parameter now says "default"
  // (edited without re-activating). Deletion must reach the session the webhook
  // actually lives on, or the registration is orphaned and keeps delivering.
  const { ctx, calls } = makeCtx({ storedSessionId: 'old-session' });
  assert.equal(await hooks().delete.call(ctx), true);
  assert.equal(calls[0].url, 'http://localhost:2785/api/sessions/old-session/webhooks/w1');
});

// --- checkExists hook wiring (unchanged configuration) ---
test('checkExists: a 404 probe reports the webhook absent so n8n recreates it', async () => {
  const { ctx } = makeCtx({ configHash: CURRENT_HASH, throwErr: { statusCode: 404 } });
  assert.equal(await hooks().checkExists.call(ctx), false);
});

test('checkExists: a non-404 error is rethrown (no silent duplicate registration)', async () => {
  const { ctx } = makeCtx({ configHash: CURRENT_HASH, throwErr: { statusCode: 500 } });
  await assert.rejects(() => hooks().checkExists.call(ctx));
});

test('checkExists: a reachable webhook reports present', async () => {
  const { ctx } = makeCtx({ configHash: CURRENT_HASH });
  assert.equal(await hooks().checkExists.call(ctx), true);
});

test('checkExists: a registration without a stored hash is re-registered once (converges)', async () => {
  // Pre-configHash static data (or anything else that lost the hash): the node
  // cannot know whether the stored registration still matches, so it replaces it.
  const { ctx, staticData, calls } = makeCtx();
  assert.equal(await hooks().checkExists.call(ctx), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'DELETE');
  assert.equal(calls[0].url, 'http://localhost:2785/api/sessions/default/webhooks/w1');
  assert.equal(staticData.webhookId, undefined);
});

test('checkExists: a legacy registration whose delete fails rethrows and keeps the id', async () => {
  const { ctx, staticData } = makeCtx({ throwErr: { statusCode: 500 } });
  await assert.rejects(() => hooks().checkExists.call(ctx));
  assert.equal(staticData.webhookId, 'w1');
});

test('checkExists: an unchanged config probes by id instead of re-registering', async () => {
  const { ctx, calls } = makeCtx({ configHash: CURRENT_HASH });
  assert.equal(await hooks().checkExists.call(ctx), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
});

// --- checkExists validates the registration it fetched, not just its existence ---
test('checkExists: a deactivated webhook is rebuilt rather than reported healthy', async () => {
  // The server dispatches only to `active: true`, so an existing-but-inactive
  // registration delivers nothing while the trigger shows activated.
  const { ctx, staticData, calls } = makeCtx({
    configHash: CURRENT_HASH,
    getResponse: { id: 'w1', active: false, url: WEBHOOK_URL, events: ['message.received'] },
  });
  assert.equal(await hooks().checkExists.call(ctx), false);
  assert.equal(calls.at(-1).method, 'DELETE');
  assert.equal(staticData.webhookId, undefined);
});

test('checkExists: a registration repointed at another URL is rebuilt', async () => {
  const { ctx, staticData } = makeCtx({
    configHash: CURRENT_HASH,
    getResponse: {
      id: 'w1',
      active: true,
      url: 'https://somewhere-else.example/webhook',
      events: ['message.received'],
    },
  });
  assert.equal(await hooks().checkExists.call(ctx), false);
  assert.equal(staticData.webhookId, undefined);
});

test('checkExists: a registration whose event list drifted is rebuilt', async () => {
  const { ctx, staticData } = makeCtx({
    configHash: CURRENT_HASH,
    getResponse: { id: 'w1', active: true, url: WEBHOOK_URL, events: ['session.status'] },
  });
  assert.equal(await hooks().checkExists.call(ctx), false);
  assert.equal(staticData.webhookId, undefined);
});

test('checkExists: event order alone is not drift', async () => {
  const { ctx } = makeCtx({
    configHash: webhookConfigHash({
      url: WEBHOOK_URL,
      events: ['message.received', 'session.status'],
      secret: '',
      sessionId: 'default',
    }),
    events: ['message.received', 'session.status'],
    getResponse: {
      id: 'w1',
      active: true,
      url: WEBHOOK_URL,
      events: ['session.status', 'message.received'],
    },
  });
  assert.equal(await hooks().checkExists.call(ctx), true);
});

// --- checkExists hook wiring (changed configuration → re-register) ---
test('checkExists: a changed config deletes the stored webhook and reports absent', async () => {
  const { ctx, staticData, calls } = makeCtx({ configHash: 'stale-hash' });
  assert.equal(await hooks().checkExists.call(ctx), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'DELETE');
  assert.equal(calls[0].url, 'http://localhost:2785/api/sessions/default/webhooks/w1');
  assert.equal(staticData.webhookId, undefined);
  assert.equal(staticData.sessionId, undefined);
  assert.equal(staticData.configHash, undefined);
});

test('checkExists: a changed secret is detected via the config hash', async () => {
  const { ctx, calls } = makeCtx({ configHash: CURRENT_HASH, secret: 'rotated' });
  assert.equal(await hooks().checkExists.call(ctx), false);
  assert.equal(calls[0].method, 'DELETE');
});

test('checkExists: a changed event selection is detected via the config hash', async () => {
  const { ctx, calls } = makeCtx({
    configHash: CURRENT_HASH,
    events: ['message.received', 'session.status'],
  });
  assert.equal(await hooks().checkExists.call(ctx), false);
  assert.equal(calls[0].method, 'DELETE');
});

test('checkExists: a stale webhook is deleted from its STORED session, not the current one', async () => {
  const { ctx, calls } = makeCtx({ configHash: 'stale-hash', storedSessionId: 'old-session' });
  assert.equal(await hooks().checkExists.call(ctx), false);
  assert.equal(calls[0].url, 'http://localhost:2785/api/sessions/old-session/webhooks/w1');
});

test('checkExists: a stale webhook already gone (DELETE 404) still reports absent', async () => {
  const { ctx, staticData } = makeCtx({ configHash: 'stale-hash', throwErr: { statusCode: 404 } });
  assert.equal(await hooks().checkExists.call(ctx), false);
  assert.equal(staticData.webhookId, undefined);
});

test('checkExists: a non-404 stale-delete failure rethrows and keeps the stored id', async () => {
  const { ctx, staticData } = makeCtx({ configHash: 'stale-hash', throwErr: { statusCode: 500 } });
  await assert.rejects(() => hooks().checkExists.call(ctx));
  assert.equal(staticData.webhookId, 'w1');
});

// --- create hook wiring ---
test('create: stores the webhook id, session id, and config hash — never the secret', async () => {
  const { ctx, staticData, calls } = makeCtx({
    webhookId: undefined,
    storedSessionId: undefined,
    secret: 'sixteen-char-secret',
  });
  assert.equal(await hooks().create.call(ctx), true);
  assert.equal(staticData.webhookId, 'w1');
  assert.equal(staticData.sessionId, 'default');
  assert.equal(
    staticData.configHash,
    webhookConfigHash({
      url: WEBHOOK_URL,
      events: ['message.received'],
      secret: 'sixteen-char-secret',
      sessionId: 'default',
    }),
  );
  assert.ok(!String(staticData.configHash).includes('sixteen-char-secret'));
  // the secret still goes to the server on registration
  assert.equal(calls[0].body.secret, 'sixteen-char-secret');
});

test('create: rejects a secret shorter than 16 characters before any request', async () => {
  const { ctx, calls } = makeCtx({
    webhookId: undefined,
    storedSessionId: undefined,
    secret: 's3cr3t',
  });
  await assert.rejects(() => hooks().create.call(ctx), /at least 16 characters/);
  assert.equal(calls.length, 0);
});

// --- node description ---
test('the webhook path is scoped to the session id', () => {
  const webhooks = new OpenWaTrigger().description.webhooks;
  assert.equal(webhooks.length, 1);
  assert.equal(webhooks[0].path, '={{ "openwa-" + $parameter["sessionId"] }}');
});

// --- server-side filters ---
test('create: registers filters alongside the URL and events', async () => {
  const { ctx, calls } = makeCtx({ filters: '{"conditions":[{"field":"fromMe","operator":"is","value":false}]}' });
  assert.equal(await hooks().create.call(ctx), true);
  const post = calls.find((c) => c.method === 'POST');
  assert.deepEqual(post.body.filters, {
    conditions: [{ field: 'fromMe', operator: 'is', value: false }],
  });
});

test('create: a webhook with no filters registers none', async () => {
  const { ctx, calls } = makeCtx();
  await hooks().create.call(ctx);
  const post = calls.find((c) => c.method === 'POST');
  assert.equal('filters' in post.body, false);
});

test('create: refuses filters that are not valid JSON', async () => {
  const { ctx } = makeCtx({ filters: '{not json' });
  await assert.rejects(() => hooks().create.call(ctx), /Filters must be valid JSON/);
});

test('checkExists: an edited filter re-registers the webhook', async () => {
  // The registration was made with no filters; the node now asks for one.
  const { ctx, staticData } = makeCtx({
    configHash: CURRENT_HASH,
    filters: '{"conditions":[{"field":"isGroup","operator":"is","value":true}]}',
  });
  assert.equal(await hooks().checkExists.call(ctx), false);
  assert.equal(staticData.webhookId, undefined);
});

test('webhookConfigHash separates two different filter sets', () => {
  const base = { url: 'u', events: ['a.b'], secret: 's', sessionId: 'x' };
  assert.notEqual(
    webhookConfigHash({ ...base, filters: '{"conditions":[]}' }),
    webhookConfigHash(base),
  );
});

// --- filters supplied as an object (an expression-driven `json` field) ---
test('create: accepts filters resolved to an object, not only typed text', async () => {
  // An n8n `json` field driven by a single expression hands the handler an object.
  // Calling .trim() on it used to throw a raw TypeError mid-activation, after
  // checkExists had already deleted the working registration.
  const filters = { conditions: [{ field: 'fromMe', operator: 'is', value: false }] };
  const { ctx, calls } = makeCtx({ filters });
  assert.equal(await hooks().create.call(ctx), true);
  assert.deepEqual(calls.find((c) => c.method === 'POST').body.filters, filters);
});

test('webhookConfigHash treats typed text and the equivalent object as the same config', () => {
  const base = { url: 'u', events: ['a.b'], secret: 's', sessionId: 'x' };
  const asText = webhookConfigHash({ ...base, filters: '{"conditions":[]}' });
  const asObject = webhookConfigHash({ ...base, filters: { conditions: [] } });
  assert.equal(asText, asObject);
});

test('webhookConfigHash ignores key order, so a reformatted filter is not a change', () => {
  const base = { url: 'u', events: ['a.b'], secret: 's', sessionId: 'x' };
  const a = webhookConfigHash({ ...base, filters: '{"conditions":[{"field":"fromMe","operator":"is","value":false}]}' });
  const b = webhookConfigHash({ ...base, filters: '{"conditions":[{"value":false,"operator":"is","field":"fromMe"}]}' });
  assert.equal(a, b);
});

test('stableStringify is order-insensitive but still distinguishes different values', () => {
  assert.equal(stableStringify({ a: 1, b: 2 }), stableStringify({ b: 2, a: 1 }));
  assert.notEqual(stableStringify({ a: 1 }), stableStringify({ a: 2 }));
  assert.equal(stableStringify([1, { z: 1, y: 2 }]), stableStringify([1, { y: 2, z: 1 }]));
});

// --- filters drift on the server side ---
test('checkExists: a filter attached out of band rebuilds the registration', async () => {
  // The action node (or the dashboard) can attach a filter to the trigger's own
  // webhook, which then suppresses deliveries with no other trace.
  const { ctx, staticData } = makeCtx({
    configHash: CURRENT_HASH,
    getResponse: {
      id: 'w1',
      active: true,
      url: WEBHOOK_URL,
      events: ['message.received'],
      filters: { conditions: [{ field: 'fromMe', operator: 'is', value: true }] },
    },
  });
  assert.equal(await hooks().checkExists.call(ctx), false);
  assert.equal(staticData.webhookId, undefined);
});

test('checkExists: a filter matching what the node registered is not drift', async () => {
  const filters = '{"conditions":[{"field":"fromMe","operator":"is","value":false}]}';
  const { ctx } = makeCtx({
    configHash: webhookConfigHash({
      url: WEBHOOK_URL,
      events: ['message.received'],
      secret: '',
      sessionId: 'default',
      filters,
    }),
    filters,
    getResponse: {
      id: 'w1',
      active: true,
      url: WEBHOOK_URL,
      events: ['message.received'],
      // Key order deliberately differs from what was registered.
      filters: { conditions: [{ value: false, operator: 'is', field: 'fromMe' }] },
    },
  });
  assert.equal(await hooks().checkExists.call(ctx), true);
});

test('checkExists: an unfiltered registration matching an unfiltered node is not drift', async () => {
  const { ctx } = makeCtx({
    configHash: CURRENT_HASH,
    getResponse: { id: 'w1', active: true, url: WEBHOOK_URL, events: ['message.received'], filters: null },
  });
  assert.equal(await hooks().checkExists.call(ctx), true);
});
