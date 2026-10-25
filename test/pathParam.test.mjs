import test from 'node:test';
import assert from 'node:assert/strict';

// Imports the compiled output, so run `npm run build` before this test.
import { sanitizePathParam } from '../dist/nodes/shared/sanitizePathParam.js';

// sanitizePathParam is the one fence between an ID typed into a node (or supplied by a caller
// using the action node as a tool, which it declares with usableAsTool) and the URL the node
// sends with the gateway credential. It is used by both nodes, and the Trigger hooks do not
// pass through the action node's own dot-segment guard, so it has to hold on its own.

test('an ordinary ID comes back unchanged', () => {
  assert.equal(sanitizePathParam('abc-123', 'Session ID'), 'abc-123');
  assert.equal(
    sanitizePathParam('0a941dac-a965-45e7-b318-74ae8be134f0', 'Session ID'),
    '0a941dac-a965-45e7-b318-74ae8be134f0',
  );
});

test('surrounding whitespace is trimmed and a number is read as its text', () => {
  assert.equal(sanitizePathParam('  abc  ', 'Session ID'), 'abc');
  assert.equal(sanitizePathParam(123, 'Session ID'), '123');
});

for (const [input, encoded] of [
  ['a b', 'a%20b'],
  ['a?b#c', 'a%3Fb%23c'],
  ['a%2Fb', 'a%252Fb'],
  ['a&b=c', 'a%26b%3Dc'],
]) {
  test(`a path-significant character is encoded: ${JSON.stringify(input)}`, () => {
    assert.equal(sanitizePathParam(input, 'Session ID'), encoded);
  });
}

for (const input of ['..', '../x', 'x/..', 'a/b', '/', 'a\\b', '\\']) {
  test(`${JSON.stringify(input)} is refused and the error names the field`, () => {
    assert.throws(
      () => sanitizePathParam(input, 'Widget ID'),
      (error) => error instanceof Error && error.message.includes('Widget ID'),
    );
  });
}

for (const input of ['', '   ', undefined, null]) {
  test(`blank input ${JSON.stringify(input)} is refused and the error names the field`, () => {
    assert.throws(
      () => sanitizePathParam(input, 'Widget ID'),
      (error) => error instanceof Error && error.message.includes('Widget ID'),
    );
  });
}

test('whatever is accepted can only ever be one inert path segment', () => {
  for (const input of ['a b', 'a?b#c', 'x%2e%2e', 'é', '😀', 'a;b', 'a:b', '@', "o'brien"]) {
    const out = sanitizePathParam(input, 'Widget ID');
    assert.match(out, /^[A-Za-z0-9\-_.!~*'()%]+$/, `unexpected character left in ${out}`);
    assert.equal(decodeURIComponent(out), input, 'the encoding must be reversible');
  }
});
