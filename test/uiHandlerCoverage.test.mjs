import test from 'node:test';
import assert from 'node:assert/strict';

// Imports the compiled output, so run `npm run build` before this test.
import * as nodeModule from '../dist/nodes/OpenWa/OpenWa.node.js';

const { OpenWa } = nodeModule;

/**
 * Every (resource, operation) pair the UI offers must reach a handler branch.
 *
 * An operation added to a resource's options list but forgotten in its handler
 * falls through to `return null` and only fails at runtime, in the user's
 * workflow, with "Unsupported resource/operation". Nothing else in the suite
 * catches that: the mapping cases are written by hand, so a new operation is
 * covered only if someone remembers to add one.
 *
 * This walks the description instead, so the check extends itself.
 */
function uiOperationPairs() {
  const { properties } = new OpenWa().description;

  const resources = properties.find((p) => p.name === 'resource');
  assert.ok(resources, 'the node must declare a resource selector');
  const known = new Set(resources.options.map((o) => o.value));

  const pairs = [];
  for (const prop of properties) {
    if (prop.name !== 'operation' || !Array.isArray(prop.options)) continue;
    // Each operation block is gated to exactly one resource by displayOptions.
    const shown = prop.displayOptions?.show?.resource ?? [];
    for (const resource of shown) {
      assert.ok(known.has(resource), `operation block names unknown resource "${resource}"`);
      for (const option of prop.options) {
        pairs.push({ resource, operation: option.value });
      }
    }
  }
  return pairs;
}

// Parameters generous enough to get past the handlers' own input validation.
// A validation error is a PASS here: it proves the handler recognised the
// operation. Only the unsupported-operation fallthrough is a failure.
const PARAMS = {
  sessionId: 'abc-123',
  chatId: '628123456789@c.us',
  fromChatId: '628123456789@c.us',
  toChatId: '628999999999@c.us',
  contactId: '628123456789@c.us',
  groupId: '1234567890@g.us',
  channelId: '1234567890@newsletter',
  messageId: 'm1',
  quotedMessageId: 'm1',
  statusBatchId: 'b1',
  batchId: '',
  labelId: 'l1',
  templateId: 't1',
  keyId: 'k1',
  apiKeyId: 'k1',
  webhookId: 'w1',
  callId: 'c1',
  statusId: 's1',
  message: 'hello',
  emoji: '👍',
  latitude: 1,
  longitude: 2,
  contactName: 'Ada',
  contactNumber: '628123456789',
  searchQuery: 'hello',
  webhookUrl: 'https://n8n.example/hook',
  events: ['message.received'],
  pollName: 'Lunch?',
  pollOptions: 'a,b',
  bulkMessages: '[{"chatId":"628123456789@c.us","type":"text","content":{"text":"hi"}}]',
};

function makeCtx(resource, operation) {
  const calls = [];
  const params = { ...PARAMS, resource, operation };
  const ctx = {
    calls,
    getInputData: () => [{ json: {} }],
    getNodeParameter: (name, _i, fallback) => (name in params ? params[name] : fallback),
    getCredentials: async () => ({ serverUrl: 'http://localhost:2785' }),
    continueOnFail: () => false,
    getNode: () => ({
      id: 'node-1',
      name: 'OpenWA',
      type: 'n8n-nodes-openwa.openWa',
      typeVersion: 1,
      position: [0, 0],
      parameters: {},
    }),
    helpers: {
      httpRequestWithAuthentication: async (credName, options) => {
        calls.push({ credName, options });
        return {};
      },
      assertBinaryData: () => ({ mimeType: 'image/png' }),
      getBinaryDataBuffer: async () => Buffer.from('IMGDATA'),
      prepareBinaryData: async (buffer) => ({
        data: buffer.toString('base64'),
        mimeType: 'application/octet-stream',
      }),
    },
  };
  return ctx;
}

test('the UI offers at least one operation per declared resource', () => {
  const pairs = uiOperationPairs();
  const covered = new Set(pairs.map((p) => p.resource));
  const declared = new OpenWa().description.properties.find((p) => p.name === 'resource');
  for (const option of declared.options) {
    assert.ok(covered.has(option.value), `resource "${option.value}" offers no operations`);
  }
});

test('every operation the UI offers reaches a handler branch', async () => {
  const pairs = uiOperationPairs();
  assert.ok(pairs.length > 100, `expected the full operation surface, got ${pairs.length}`);

  const unreachable = [];
  for (const { resource, operation } of pairs) {
    const ctx = makeCtx(resource, operation);
    try {
      await new OpenWa().execute.call(ctx);
    } catch (error) {
      // A handler rejecting the fake input is fine; falling through is not.
      if (/Unsupported resource\/operation/.test(error.message)) {
        unreachable.push(`${resource}/${operation}`);
      }
    }
  }

  assert.deepEqual(unreachable, [], `operations offered by the UI with no handler branch:\n${unreachable.join('\n')}`);
});
