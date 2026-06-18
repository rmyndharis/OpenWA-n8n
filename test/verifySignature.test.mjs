import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

// Imports the compiled output, so run `npm run build` before this test.
import * as sig from '../dist/nodes/OpenWaTrigger/verifySignature.js';

const secret = 'test-secret-123';
const body = JSON.stringify({
  event: 'message.received',
  sessionId: 'default',
  data: { id: '3EB0ABC' },
});
const goodSig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

test('accepts a valid signature over the raw string body', () => {
  assert.equal(sig.verifyOpenWaSignature(body, secret, goodSig), true);
});

test('accepts a valid signature when the raw body is a Buffer', () => {
  assert.equal(sig.verifyOpenWaSignature(Buffer.from(body), secret, goodSig), true);
});

test('rejects a tampered body', () => {
  assert.equal(sig.verifyOpenWaSignature(body + ' ', secret, goodSig), false);
});

test('rejects a wrong secret', () => {
  assert.equal(sig.verifyOpenWaSignature(body, 'wrong-secret', goodSig), false);
});

test('rejects a missing signature header', () => {
  assert.equal(sig.verifyOpenWaSignature(body, secret, undefined), false);
});

test('rejects an empty signature header', () => {
  assert.equal(sig.verifyOpenWaSignature(body, secret, ''), false);
});

test('rejects a header missing the sha256= prefix', () => {
  const bareHex = createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(sig.verifyOpenWaSignature(body, secret, bareHex), false);
});
