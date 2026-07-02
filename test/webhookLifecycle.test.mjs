import test from 'node:test';
import assert from 'node:assert/strict';

// Imports compiled output, so run `npm run build` before this test.
import { httpStatusFromError } from '../dist/nodes/OpenWaTrigger/httpStatus.js';
import * as triggerModule from '../dist/nodes/OpenWaTrigger/OpenWaTrigger.node.js';

const { OpenWaTrigger } = triggerModule;

// A plain fake `this` for the webhook lifecycle hooks — no n8n mock framework.
// `staticData` is returned by reference so tests can assert the id was cleared.
function makeCtx({ webhookId = 'w1', throwErr = null } = {}) {
  const staticData = webhookId === undefined ? {} : { webhookId };
  const ctx = {
    getWorkflowStaticData: () => staticData,
    getCredentials: async () => ({ serverUrl: 'http://localhost:2785' }),
    getNodeParameter: () => 'default',
    helpers: {
      httpRequestWithAuthentication: async () => {
        if (throwErr) throw throwErr;
        return {};
      },
    },
  };
  return { ctx, staticData };
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

// --- delete hook wiring (behavior must be unchanged by the refactor) ---
test('delete: an already-gone webhook (404) is swallowed and the id cleared', async () => {
  const { ctx, staticData } = makeCtx({ throwErr: { statusCode: 404 } });
  assert.equal(await hooks().delete.call(ctx), true);
  assert.equal(staticData.webhookId, undefined);
});

test('delete: a non-404 error is rethrown', async () => {
  const { ctx } = makeCtx({ throwErr: { statusCode: 500 } });
  await assert.rejects(() => hooks().delete.call(ctx));
});

// --- checkExists hook wiring ---
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
