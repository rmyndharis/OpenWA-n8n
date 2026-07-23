import test from 'node:test';
import assert from 'node:assert/strict';

// Imports compiled output, so run `npm run build` before this test.
import { httpStatusFromError } from '../dist/nodes/OpenWaTrigger/httpStatus.js';
import { webhookConfigHash } from '../dist/nodes/OpenWaTrigger/configHash.js';
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
  throwErr = null,
  createResponse = { id: 'w1' },
} = {}) {
  const staticData = {};
  if (webhookId !== undefined) staticData.webhookId = webhookId;
  if (storedSessionId !== undefined) staticData.sessionId = storedSessionId;
  if (configHash !== undefined) staticData.configHash = configHash;
  const calls = [];
  const params = { sessionId: 'default', events, webhookSecret: secret };
  const ctx = {
    calls,
    getWorkflowStaticData: () => staticData,
    getCredentials: async () => ({ serverUrl: 'http://localhost:2785' }),
    getNodeParameter: (name) => params[name],
    getNodeWebhookUrl: () => WEBHOOK_URL,
    helpers: {
      httpRequestWithAuthentication: async (_cred, options) => {
        calls.push(options);
        if (throwErr) throw throwErr;
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

// --- checkExists hook wiring (unchanged configuration) ---
test('checkExists: a 404 probe reports the webhook absent so n8n recreates it', async () => {
  const { ctx } = makeCtx({ throwErr: { statusCode: 404 } });
  assert.equal(await hooks().checkExists.call(ctx), false);
});

test('checkExists: a non-404 error is rethrown (no silent duplicate registration)', async () => {
  const { ctx } = makeCtx({ throwErr: { statusCode: 500 } });
  await assert.rejects(() => hooks().checkExists.call(ctx));
});

test('checkExists: a reachable webhook reports present', async () => {
  const { ctx } = makeCtx();
  assert.equal(await hooks().checkExists.call(ctx), true);
});

test('checkExists: an unchanged config probes by id instead of re-registering', async () => {
  const { ctx, calls } = makeCtx({ configHash: CURRENT_HASH });
  assert.equal(await hooks().checkExists.call(ctx), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
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
    secret: 's3cr3t',
  });
  assert.equal(await hooks().create.call(ctx), true);
  assert.equal(staticData.webhookId, 'w1');
  assert.equal(staticData.sessionId, 'default');
  assert.equal(
    staticData.configHash,
    webhookConfigHash({
      url: WEBHOOK_URL,
      events: ['message.received'],
      secret: 's3cr3t',
      sessionId: 'default',
    }),
  );
  assert.ok(!String(staticData.configHash).includes('s3cr3t'));
  // the secret still goes to the server on registration
  assert.equal(calls[0].body.secret, 's3cr3t');
});
