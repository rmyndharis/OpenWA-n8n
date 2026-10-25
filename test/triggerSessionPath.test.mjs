import test from 'node:test';
import assert from 'node:assert/strict';

// Imports compiled output, so run `npm run build` before this test.
import { webhookConfigHash } from '../dist/nodes/OpenWaTrigger/configHash.js';
import { OpenWaTrigger } from '../dist/nodes/OpenWaTrigger/OpenWaTrigger.node.js';

// The Trigger's hooks build their URLs from the Session parameter themselves and never pass
// through the action node's dot-segment guard, so sanitizePathParam is their only fence.
// They also store the session they registered on and reuse it later, and that stored value
// is already encoded: encoding it again would corrupt any ID that encoding touches.
// webhookLifecycle.test.mjs only ever uses the plain IDs 'default' and 'old-session'.

const BASE = 'http://localhost:2785';
const WEBHOOK_URL = 'https://n8n.example/webhook/test';
const EVENTS = ['message.received'];

function makeCtx({ sessionId, storedSessionId, webhookId = 'w1', configHash } = {}) {
  const staticData = {};
  if (webhookId !== undefined) staticData.webhookId = webhookId;
  if (storedSessionId !== undefined) staticData.sessionId = storedSessionId;
  if (configHash !== undefined) staticData.configHash = configHash;
  const params = { sessionId, events: EVENTS, webhookSecret: '' };
  const calls = [];
  const ctx = {
    getWorkflowStaticData: () => staticData,
    getCredentials: async () => ({ serverUrl: BASE }),
    getNode: () => ({ id: 'node-1', name: 'OpenWA Trigger' }),
    getNodeParameter: (name, fallback) => (name in params ? params[name] : fallback),
    getNodeWebhookUrl: () => WEBHOOK_URL,
    helpers: {
      httpRequestWithAuthentication: async (_cred, options) => {
        calls.push(options);
        if (options.method === 'GET' && options.url.endsWith('/webhooks')) return [];
        if (options.method === 'GET') {
          return { id: webhookId, active: true, url: WEBHOOK_URL, events: EVENTS };
        }
        return { id: 'w1' };
      },
    },
  };
  return { ctx, calls, staticData };
}

const hooks = () => new OpenWaTrigger().webhookMethods.default;
const hashFor = (sessionId) =>
  webhookConfigHash({ url: WEBHOOK_URL, events: EVENTS, secret: '', sessionId });

const SESSION_PATHS = ['..', '../x', 'a/b', 'a\\b'];

for (const [hook, setup] of [
  ['create', { webhookId: undefined }],
  ['checkExists', { webhookId: 'w1' }],
]) {
  for (const sessionId of SESSION_PATHS) {
    test(`${hook} refuses the session ${JSON.stringify(sessionId)} before any request`, async () => {
      const { ctx, calls } = makeCtx({ sessionId, ...setup });
      await assert.rejects(
        () => hooks()[hook].call(ctx),
        (error) => /session/i.test(error.message),
      );
      assert.equal(calls.length, 0, 'nothing may reach the wire');
    });
  }
}

test('delete without a stored session refuses a path-shaped session before any request', async () => {
  for (const sessionId of SESSION_PATHS) {
    const { ctx, calls } = makeCtx({ sessionId, storedSessionId: undefined });
    await assert.rejects(
      () => hooks().delete.call(ctx),
      (error) => /session/i.test(error.message),
    );
    assert.equal(calls.length, 0, 'nothing may reach the wire');
  }
});

test('create encodes a session ID that needs it, on every request it makes', async () => {
  const { ctx, calls } = makeCtx({ sessionId: 'a b?c', webhookId: undefined });
  assert.equal(await hooks().create.call(ctx), true);
  assert.ok(calls.length >= 1);
  for (const { url } of calls) {
    assert.ok(url.startsWith(`${BASE}/api/sessions/a%20b%3Fc/webhooks`), url);
  }
});

test('checkExists encodes the session ID it probes', async () => {
  const { ctx, calls } = makeCtx({
    sessionId: 'a b?c',
    storedSessionId: 'a%20b%3Fc',
    configHash: hashFor('a b?c'),
  });
  await hooks().checkExists.call(ctx);
  assert.equal(calls[0].url, `${BASE}/api/sessions/a%20b%3Fc/webhooks/w1`);
});

test('delete without a stored session sanitizes the current one', async () => {
  const { ctx, calls } = makeCtx({ sessionId: 'a b', storedSessionId: undefined });
  assert.equal(await hooks().delete.call(ctx), true);
  assert.equal(calls[0].url, `${BASE}/api/sessions/a%20b/webhooks/w1`);
});

test('delete uses the stored session as it is, without encoding it a second time', async () => {
  const { ctx, calls } = makeCtx({ sessionId: 'other', storedSessionId: 'my%20session' });
  assert.equal(await hooks().delete.call(ctx), true);
  assert.equal(calls[0].url, `${BASE}/api/sessions/my%20session/webhooks/w1`);
});

test('removing a stale registration uses the stored session as it is, without encoding it again', async () => {
  const { ctx, calls } = makeCtx({
    sessionId: 'other',
    storedSessionId: 'my%20session',
    configHash: 'stale-hash',
  });
  assert.equal(await hooks().checkExists.call(ctx), false);
  const removal = calls.find((call) => call.method === 'DELETE');
  assert.equal(removal.url, `${BASE}/api/sessions/my%20session/webhooks/w1`);
});
