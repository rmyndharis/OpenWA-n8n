import test from 'node:test';
import assert from 'node:assert/strict';

// Imports the compiled output, so run `npm run build` before this test.
import { OpenWa } from '../dist/nodes/OpenWa/OpenWa.node.js';
import { OpenWaTrigger } from '../dist/nodes/OpenWaTrigger/OpenWaTrigger.node.js';

const BASE = 'http://localhost:2785';

// Fake ILoadOptionsFunctions: captures the request and returns a canned body.
function makeCtx({ response = [], sessionId = 'abc-123' } = {}) {
  const calls = [];
  return {
    calls,
    getCredentials: async () => ({ serverUrl: BASE }),
    getCurrentNodeParameter: (name) => (name === 'sessionId' ? sessionId : undefined),
    helpers: {
      httpRequestWithAuthentication: async (credName, options) => {
        calls.push({ credName, options });
        return response;
      },
    },
  };
}

/** Builds a full page of `size` distinct entries, prefixed to stay unique. */
function page(prefix, size) {
  return Array.from({ length: size }, (_, i) => ({ id: `${prefix}-${i}`, name: `${prefix}-${i}` }));
}

const { loadOptions } = new OpenWa().methods;

test('getSessions lists sessions by name with the id appended', async () => {
  const ctx = makeCtx({
    response: [
      { id: 's2', name: 'Support' },
      { id: 's1', name: 'Sales' },
    ],
  });
  const options = await loadOptions.getSessions.call(ctx);
  assert.equal(ctx.calls[0].options.url, `${BASE}/api/sessions`);
  assert.equal(ctx.calls[0].credName, 'openWaApi');
  // Sorted by label, so Sales precedes Support regardless of response order.
  assert.deepEqual(options, [
    { name: 'Sales (s1)', value: 's1' },
    { name: 'Support (s2)', value: 's2' },
  ]);
});

test('getGroups scopes the request to the selected session', async () => {
  const ctx = makeCtx({
    response: [{ id: '12036@g.us', name: 'Project Team', linkedParentJID: null }],
  });
  const options = await loadOptions.getGroups.call(ctx);
  assert.equal(ctx.calls[0].options.url, `${BASE}/api/sessions/abc-123/groups`);
  assert.deepEqual(options, [{ name: 'Project Team (12036@g.us)', value: '12036@g.us' }]);
});

test('a session-scoped loader makes no request until a session is chosen', async () => {
  const ctx = makeCtx({ sessionId: '   ' });
  const options = await loadOptions.getGroups.call(ctx);
  assert.deepEqual(options, []);
  assert.equal(ctx.calls.length, 0, 'must not request a URL with an empty session id');
});

test('a session id is percent-encoded into the loader URL', async () => {
  const ctx = makeCtx({ sessionId: 'my session/../x', response: [] });
  await loadOptions.getLabels.call(ctx);
  assert.equal(ctx.calls[0].options.url, `${BASE}/api/sessions/my%20session%2F..%2Fx/labels`);
});

test('getWebhooks labels entries by URL, since webhooks carry no name', async () => {
  const ctx = makeCtx({ response: [{ id: 'w1', url: 'https://n8n.example/hook' }] });
  const options = await loadOptions.getWebhooks.call(ctx);
  assert.deepEqual(options, [{ name: 'https://n8n.example/hook (w1)', value: 'w1' }]);
});

test('an entry with no label falls back to its bare id', async () => {
  const ctx = makeCtx({ response: [{ id: 'l1' }] });
  const options = await loadOptions.getLabels.call(ctx);
  assert.deepEqual(options, [{ name: 'l1', value: 'l1' }]);
});

test('entries without a usable id are skipped rather than offered as blanks', async () => {
  const ctx = makeCtx({ response: [{ name: 'no id here' }, { id: '', name: 'blank' }, { id: 'ok' }] });
  const options = await loadOptions.getLabels.call(ctx);
  assert.deepEqual(options, [{ name: 'ok', value: 'ok' }]);
});

test('an unexpected response shape yields no options instead of throwing', async () => {
  for (const response of [null, undefined, 'nope', 42, {}]) {
    const ctx = makeCtx({ response });
    assert.deepEqual(await loadOptions.getLabels.call(ctx), [], `for ${JSON.stringify(response)}`);
  }
});

test('getApiKeys is not session-scoped', async () => {
  const ctx = makeCtx({ sessionId: '', response: [{ id: 'k1', name: 'ops' }] });
  const options = await loadOptions.getApiKeys.call(ctx);
  assert.equal(ctx.calls[0].options.url, `${BASE}/api/auth/api-keys`);
  assert.deepEqual(options, [{ name: 'ops (k1)', value: 'k1' }]);
});

// --- Paging ------------------------------------------------------------------
// Exactly one page per dropdown. Walking every page would fire a request per
// thousand records each time the field opens, for a list nobody scrolls to the
// end of — beyond the page size the field takes an expression instead.

test('a paginated loader asks for one page at the server ceiling', async () => {
  const ctx = makeCtx({ response: [] });
  await loadOptions.getSessions.call(ctx);
  assert.deepEqual(ctx.calls[0].options.qs, { limit: 1000 });
});

test('a full page does NOT trigger a follow-up request', async () => {
  const ctx = makeCtx({ response: page('a', 1000) });
  const options = await loadOptions.getChats.call(ctx);
  assert.equal(ctx.calls.length, 1, 'a full page must not be chased with another request');
  assert.equal(options.length, 1000);
});

test('a session-scoped paginated loader sends the limit too', async () => {
  const ctx = makeCtx({ response: page('c', 2) });
  await loadOptions.getContacts.call(ctx);
  assert.equal(ctx.calls.length, 1);
  assert.deepEqual(ctx.calls[0].options.qs, { limit: 1000 });
});

test('an unpaginated route is fetched with no query parameters at all', async () => {
  const ctx = makeCtx({ response: page('l', 1000) });
  await loadOptions.getLabels.call(ctx);
  assert.equal(ctx.calls.length, 1, 'labels return everything in one response');
  assert.equal(ctx.calls[0].options.qs, undefined);
});

test('getContacts falls back to pushName, then number, when there is no name', async () => {
  const ctx = makeCtx({
    response: [
      { id: '1@c.us', name: 'Jane Doe', pushName: 'Jane' },
      { id: '2@c.us', pushName: 'Bob' },
      { id: '3@c.us', number: '628123456789' },
    ],
  });
  const options = await loadOptions.getContacts.call(ctx);
  assert.deepEqual(options, [
    { name: '628123456789 (3@c.us)', value: '3@c.us' },
    { name: 'Bob (2@c.us)', value: '2@c.us' },
    { name: 'Jane Doe (1@c.us)', value: '1@c.us' },
  ]);
});

test('a trailing slash on the server URL does not produce a double slash', async () => {
  const ctx = makeCtx();
  ctx.getCredentials = async () => ({ serverUrl: `${BASE}/` });
  await loadOptions.getSessions.call(ctx);
  assert.equal(ctx.calls[0].options.url, `${BASE}/api/sessions`);
});

// --- Trigger node ------------------------------------------------------------
// The Trigger has its own Session ID field, so it needs its own loader wiring.

test('the Trigger offers a session dropdown backed by the same loader', async () => {
  const trigger = new OpenWaTrigger();
  const sessionField = trigger.description.properties.find((p) => p.name === 'sessionId');

  assert.equal(sessionField.type, 'options', 'the Trigger session field must be a dropdown');
  assert.equal(sessionField.typeOptions?.loadOptionsMethod, 'getSessions');
  assert.equal(sessionField.default, '', 'a preselected id would not exist in the loaded list');
  assert.equal(typeof trigger.methods?.loadOptions?.getSessions, 'function');
});

test('the Trigger loader hits the same endpoint as the action node', async () => {
  const ctx = makeCtx({ response: [{ id: 's1', name: 'Sales' }] });
  const options = await new OpenWaTrigger().methods.loadOptions.getSessions.call(ctx);
  assert.equal(ctx.calls[0].options.url, `${BASE}/api/sessions`);
  assert.equal(ctx.calls[0].credName, 'openWaApi');
  assert.deepEqual(options, [{ name: 'Sales (s1)', value: 's1' }]);
});
