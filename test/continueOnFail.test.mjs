import test from 'node:test';
import assert from 'node:assert/strict';

// Imports the compiled output, so run `npm run build` before this test.
import * as nodeModule from '../dist/nodes/OpenWa/OpenWa.node.js';

const { OpenWa } = nodeModule;

// What a failed item looks like when the user keeps going past it, and which input item it
// is attributed to. The wording of a message is deliberately not asserted anywhere here:
// only the key set, the relation to the error the same failure throws, and the pairing.
// Why the key set matters: n8n sends an item to the error output only when its json holds
// nothing beyond error and message, and then merges the input item underneath, so a stray
// `message` or `item.error` key either loses that routing or overwrites the input's own
// columns. Regular output keeps { error, description }, the shape saved workflows read.

const params = {
  resource: 'message',
  operation: 'sendText',
  sessionId: 'abc-123',
  chatId: '1@c.us',
  message: 'hi',
};

const refusal = () =>
  Object.assign(new Error('Request failed with status code 409'), {
    response: { status: 409, data: { message: 'Session is not ready (status: disconnected)' } },
  });

function makeCtx({ items = 1, failOnCall = 0, continueOnFail = true, onError, perItem = {} } = {}) {
  const calls = [];
  return {
    calls,
    getTimezone: () => 'UTC',
    getInputData: () => Array.from({ length: items }, () => ({ json: {} })),
    getNodeParameter: (name, i, fallback) => {
      if (name in perItem) return perItem[name][i];
      return name in params ? params[name] : fallback;
    },
    getCredentials: async () => ({ serverUrl: 'http://localhost:2785' }),
    continueOnFail: () => continueOnFail,
    getNode: () => ({
      id: 'node-1',
      name: 'OpenWA',
      type: 'n8n-nodes-openwa.openWa',
      typeVersion: 2,
      position: [0, 0],
      parameters: {},
      onError,
    }),
    helpers: {
      httpRequestWithAuthentication: async (credName, options) => {
        calls.push({ credName, options });
        if (failOnCall === 0 || calls.length === failOnCall) throw refusal();
        return { id: `sent-${calls.length}` };
      },
    },
  };
}

const sorted = (object) => Object.keys(object).sort();

// The error the same failure throws when Continue On Fail is off.
async function thrownBy(options) {
  try {
    await new OpenWa().execute.call(makeCtx({ ...options, continueOnFail: false }));
  } catch (error) {
    return error;
  }
  throw new Error('expected the run to throw');
}

for (const onError of [undefined, 'continueRegularOutput']) {
  test(`regular output (onError ${onError}) keeps exactly { error, description }`, async () => {
    const [output] = await new OpenWa().execute.call(makeCtx({ onError }));
    const [item] = output;
    const thrown = await thrownBy({ onError });
    assert.deepEqual(sorted(item.json), ['description', 'error']);
    assert.equal(item.json.error, thrown.message);
    assert.equal(typeof item.json.description, 'string');
    assert.ok(item.json.description.length > 0);
    assert.equal(item.error, undefined, 'item.error would make n8n rewrite the json');
    assert.deepEqual(item.pairedItem, { item: 0 });
  });
}

test('error output keeps exactly { error } and folds the reason into it', async () => {
  const [output] = await new OpenWa().execute.call(makeCtx({ onError: 'continueErrorOutput' }));
  const [item] = output;
  const thrown = await thrownBy({ onError: 'continueErrorOutput' });
  assert.deepEqual(sorted(item.json), ['error']);
  assert.ok(item.json.error.startsWith(thrown.message), 'the headline leads the reason');
  assert.ok(item.json.error.length > thrown.message.length, 'the reason follows it');
  assert.equal(item.error, undefined);
});

for (const onError of [undefined, 'continueRegularOutput', 'continueErrorOutput']) {
  test(`a failure with no reason from the server carries only { error } (onError ${onError})`, async () => {
    // The node's own validation: nothing was sent, so there is no description to add.
    const ctx = makeCtx({ onError, perItem: { sessionId: ['  '] } });
    const [output] = await new OpenWa().execute.call(ctx);
    assert.equal(ctx.calls.length, 0);
    assert.deepEqual(sorted(output[0].json), ['error']);
    assert.equal(typeof output[0].json.error, 'string');
  });
}

for (const onError of [undefined, 'continueRegularOutput', 'continueErrorOutput']) {
  test(`a request failing on the second of three items is attributed to it (onError ${onError})`, async () => {
    const ctx = makeCtx({ items: 3, failOnCall: 2, onError });
    const [output] = await new OpenWa().execute.call(ctx);
    assert.equal(output.length, 3);
    assert.deepEqual(
      output.map((item) => item.pairedItem),
      [{ item: 0 }, { item: 1 }, { item: 2 }],
    );
    assert.deepEqual(
      output.map((item) => 'error' in item.json),
      [false, true, false],
    );
    assert.equal(ctx.calls.length, 3, 'the items after the failure still run');
  });
}

test('a validation failure on the last of three items is attributed to it', async () => {
  const ctx = makeCtx({ items: 3, perItem: { sessionId: ['abc-123', 'abc-123', '  '] } });
  ctx.helpers.httpRequestWithAuthentication = async (_cred, options) => {
    ctx.calls.push(options);
    return { id: 'sent' };
  };
  const [output] = await new OpenWa().execute.call(ctx);
  assert.deepEqual(
    output.map((item) => item.pairedItem),
    [{ item: 0 }, { item: 1 }, { item: 2 }],
  );
  assert.deepEqual(
    output.map((item) => 'error' in item.json),
    [false, false, true],
  );
  assert.equal(ctx.calls.length, 2);
});
