import test from 'node:test';
import assert from 'node:assert/strict';

// Imports the compiled output, so run `npm run build` before this test.
import { OpenWa } from '../dist/nodes/OpenWa/OpenWa.node.js';
import { OpenWaTrigger } from '../dist/nodes/OpenWaTrigger/OpenWaTrigger.node.js';
import { serverBaseUrl } from '../dist/nodes/shared/serverUrl.js';

const BASE = 'http://localhost:2785';

// n8n's credential test joins the Server URL and the path through axios, which drops
// every trailing slash, so a pasted `https://host//` passes it. Every request builder
// must agree, or the credential is green while each operation is a 404.
const PASTED = [
  [`${BASE}`, BASE],
  [`${BASE}/`, BASE],
  [`${BASE}//`, BASE],
  [`${BASE}///`, BASE],
  [`  ${BASE}/ \n`, BASE],
  ['https://host/openwa/', 'https://host/openwa'],
  ['https://host/openwa//', 'https://host/openwa'],
];

for (const [input, expected] of PASTED) {
  test(`serverBaseUrl(${JSON.stringify(input)}) is ${expected}`, () => {
    assert.equal(serverBaseUrl(input), expected);
  });
}

test('Session > List All requests a single-slash URL for a Server URL with extra trailing slashes', async () => {
  const calls = [];
  const ctx = {
    getInputData: () => [{ json: {} }],
    getNodeParameter: (name, _i, fallback) =>
      ({ resource: 'session', operation: 'listAll' })[name] ?? fallback,
    getCredentials: async () => ({ serverUrl: `${BASE}//` }),
    continueOnFail: () => false,
    getNode: () => ({
      id: 'n',
      name: 'OpenWA',
      type: 'n8n-nodes-openwa.openWa',
      typeVersion: 2,
      position: [0, 0],
      parameters: {},
    }),
    helpers: {
      httpRequestWithAuthentication: async (_cred, options) => {
        calls.push(options.url);
        return [];
      },
    },
  };
  await new OpenWa().execute.call(ctx);
  assert.deepEqual(calls, [`${BASE}/api/sessions`]);
});

test('the session dropdown requests a single-slash URL for a Server URL with extra trailing slashes', async () => {
  const calls = [];
  const ctx = {
    getCredentials: async () => ({ serverUrl: `${BASE}///` }),
    getCurrentNodeParameter: () => undefined,
    helpers: {
      httpRequestWithAuthentication: async (_cred, options) => {
        calls.push(options.url);
        return [];
      },
    },
  };
  await new OpenWa().methods.loadOptions.getSessions.call(ctx);
  assert.deepEqual(calls, [`${BASE}/api/sessions`]);
});

test('the Trigger deregisters through a single-slash URL for a Server URL with extra trailing slashes', async () => {
  const calls = [];
  const staticData = { webhookId: 'w1', sessionId: 'default' };
  const ctx = {
    getWorkflowStaticData: () => staticData,
    getCredentials: async () => ({ serverUrl: `${BASE}//` }),
    getNode: () => ({ id: 'n', name: 'OpenWA Trigger' }),
    getNodeParameter: (_name, fallback) => fallback,
    helpers: {
      httpRequestWithAuthentication: async (_cred, options) => {
        calls.push(`${options.method} ${options.url}`);
        return {};
      },
    },
  };
  await new OpenWaTrigger().webhookMethods.default.delete.call(ctx);
  assert.deepEqual(calls, [`DELETE ${BASE}/api/sessions/default/webhooks/w1`]);
});
