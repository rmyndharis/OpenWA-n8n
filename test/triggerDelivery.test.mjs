import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

// Imports the compiled output, so run `npm run build` before this test.
import * as triggerModule from '../dist/nodes/OpenWaTrigger/OpenWaTrigger.node.js';

const { OpenWaTrigger } = triggerModule;

const SECRET = 's3cr3t';
const BODY = { event: 'message.received', deliveryId: 'd1', data: { id: 'm1' } };
const RAW = JSON.stringify(BODY);
const GOOD_SIG = 'sha256=' + createHmac('sha256', SECRET).update(RAW).digest('hex');

// A plain fake `this` for the delivery handler — no n8n mock framework.
// `staticData` is returned by reference so tests can inspect dedup state.
function makeCtx({
  secret = '',
  deduplicate = false,
  rawBody,
  body = BODY,
  signatureHeader,
  staticData = {},
  // 'missing' → no readRawBody; 'noop' → present but populates nothing;
  // 'populates' → sets req.rawBody like modern n8n does.
  readRawBody = 'missing',
} = {}) {
  const logs = [];
  const responseCalls = [];
  const params = { webhookSecret: secret, deduplicateDeliveries: deduplicate };
  const req = {
    body,
    rawBody,
    headers: signatureHeader ? { 'x-openwa-signature': signatureHeader } : {},
  };
  if (readRawBody === 'noop') {
    req.readRawBody = async () => {};
  } else if (readRawBody === 'populates') {
    req.readRawBody = async () => {
      req.rawBody = RAW;
    };
  }
  const res = {
    status: (code) => {
      responseCalls.push(['status', code]);
      return res;
    },
    send: (text) => {
      responseCalls.push(['send', text]);
      return res;
    },
  };
  const ctx = {
    getNodeParameter: (name, fallback) => (name in params ? params[name] : fallback),
    getRequestObject: () => req,
    getResponseObject: () => res,
    getWorkflowStaticData: () => staticData,
    logger: {
      warn: (msg) => logs.push(['warn', msg]),
      debug: (msg) => logs.push(['debug', msg]),
    },
    helpers: {
      returnJsonArray: (data) => [{ json: data }],
    },
  };
  return { ctx, staticData, logs, responseCalls };
}

const deliver = (ctx) => new OpenWaTrigger().webhook.call(ctx);

// --- unsigned / signature handling ---
test('an unsigned configuration passes the payload through', async () => {
  const { ctx } = makeCtx();
  const result = await deliver(ctx);
  assert.deepEqual(result.workflowData[0][0].json, BODY);
});

test('a valid signature over the raw body passes the payload through', async () => {
  const { ctx } = makeCtx({ secret: SECRET, rawBody: RAW, signatureHeader: GOOD_SIG });
  const result = await deliver(ctx);
  assert.deepEqual(result.workflowData[0][0].json, BODY);
});

test('a failed signature rejects with 401 and does not run the workflow', async () => {
  const { ctx, responseCalls } = makeCtx({
    secret: SECRET,
    rawBody: RAW,
    signatureHeader: 'sha256=deadbeef',
  });
  const result = await deliver(ctx);
  assert.deepEqual(responseCalls, [['status', 401], ['send', 'Unauthorized']]);
  assert.equal(result.noWebhookResponse, true);
  assert.deepEqual(result.workflowData, [[]]);
});

test('a raw body populated by readRawBody() verifies normally', async () => {
  const { ctx } = makeCtx({
    secret: SECRET,
    rawBody: undefined,
    readRawBody: 'populates',
    signatureHeader: GOOD_SIG,
  });
  const result = await deliver(ctx);
  assert.deepEqual(result.workflowData[0][0].json, BODY);
});

test('a signed config without any raw body rejects loudly (no silent re-serialization)', async () => {
  const { ctx, logs, responseCalls } = makeCtx({
    secret: SECRET,
    rawBody: undefined,
    readRawBody: 'missing',
    signatureHeader: GOOD_SIG,
  });
  const result = await deliver(ctx);
  assert.deepEqual(responseCalls, [['status', 401], ['send', 'Unauthorized']]);
  assert.equal(result.noWebhookResponse, true);
  assert.deepEqual(result.workflowData, [[]]);
  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], 'warn');
  assert.match(logs[0][1], /raw request body/i);
});

test('a readRawBody that populates nothing still rejects loudly', async () => {
  const { ctx, responseCalls } = makeCtx({
    secret: SECRET,
    rawBody: undefined,
    readRawBody: 'noop',
    signatureHeader: GOOD_SIG,
  });
  const result = await deliver(ctx);
  assert.deepEqual(responseCalls, [['status', 401], ['send', 'Unauthorized']]);
  assert.deepEqual(result.workflowData, [[]]);
});

// --- de-duplication ---
test('dedup disabled: a repeated deliveryId runs the workflow again', async () => {
  const staticData = { recentDeliveryIds: ['d1'] };
  const { ctx } = makeCtx({ staticData });
  const result = await deliver(ctx);
  assert.deepEqual(result.workflowData[0][0].json, BODY);
});

test('dedup enabled: the first delivery runs and is recorded', async () => {
  const { ctx, staticData } = makeCtx({ deduplicate: true });
  const result = await deliver(ctx);
  assert.deepEqual(result.workflowData[0][0].json, BODY);
  assert.deepEqual(staticData.recentDeliveryIds, ['d1']);
});

test('dedup enabled: a repeated deliveryId is dropped without running or 401', async () => {
  const staticData = { recentDeliveryIds: ['d1'] };
  const { ctx, responseCalls } = makeCtx({ deduplicate: true, staticData });
  const result = await deliver(ctx);
  assert.deepEqual(result.workflowData, [[]]);
  assert.deepEqual(responseCalls, []);
  assert.deepEqual(staticData.recentDeliveryIds, ['d1']);
});

test('dedup enabled: a delivery without a deliveryId always passes', async () => {
  const staticData = { recentDeliveryIds: ['d1'] };
  const { ctx } = makeCtx({ deduplicate: true, staticData, body: { event: 'session.status' } });
  const result = await deliver(ctx);
  assert.deepEqual(result.workflowData[0][0].json, { event: 'session.status' });
});

test('dedup state is bounded to the 500 most recent ids', async () => {
  const staticData = {
    recentDeliveryIds: Array.from({ length: 500 }, (_, i) => `old-${i}`),
  };
  const { ctx } = makeCtx({ deduplicate: true, staticData });
  await deliver(ctx);
  assert.equal(staticData.recentDeliveryIds.length, 500);
  assert.ok(staticData.recentDeliveryIds.includes('d1'));
  assert.ok(!staticData.recentDeliveryIds.includes('old-0'));
});
