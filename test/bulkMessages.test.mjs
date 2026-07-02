import test from 'node:test';
import assert from 'node:assert/strict';

// Imports compiled output, so run `npm run build` before this test.
import { parseBulkMessages } from '../dist/nodes/OpenWa/bulkMessages.js';

test('parses a JSON-string array', () => {
  assert.deepEqual(parseBulkMessages('[{"chatId":"1@c.us"}]'), [{ chatId: '1@c.us' }]);
});

test('passes an already-parsed array through', () => {
  const arr = [{ chatId: '1@c.us' }];
  assert.equal(parseBulkMessages(arr), arr);
});

test('rejects invalid JSON', () => {
  assert.throws(() => parseBulkMessages('{not json'));
});

test('rejects a non-array', () => {
  assert.throws(() => parseBulkMessages('{"chatId":"1@c.us"}'), /must be a JSON array/);
});

test('rejects an empty array', () => {
  assert.throws(() => parseBulkMessages('[]'), /at least one item/);
});

test('rejects more than 100 items', () => {
  const big = JSON.stringify(Array.from({ length: 101 }, () => ({ chatId: '1@c.us' })));
  assert.throws(() => parseBulkMessages(big), /exceed 100 items/);
});

test('accepts exactly 100 items', () => {
  const items = Array.from({ length: 100 }, () => ({ chatId: '1@c.us' }));
  assert.equal(parseBulkMessages(items).length, 100);
});
