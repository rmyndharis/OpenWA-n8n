import test from 'node:test';
import assert from 'node:assert/strict';

// Imports the compiled output, so run `npm run build` before this test.
import { OpenWa } from '../dist/nodes/OpenWa/OpenWa.node.js';

// Two inputs the gateway's production 400 does not name, or accepts and rewrites into text.
// Mentions: the gateway refuses anything but a domain-qualified individual ID, and in
// production says only "Bad Request". The node refuses what carries no domain at all and
// leaves the rest to the gateway, whose rules for the number part have been tightened before,
// so this check can never refuse a value the gateway accepts.
// Emoji and MIME type: an object resolved from an expression is turned into the text
// "[object Object]" by older gateways and sent. null and '' are NOT opaque objects: on React
// an empty emoji removes the reaction, and null must keep reaching the gateway unchanged.

function makeCtx(params) {
  const calls = [];
  return {
    calls,
    getTimezone: () => 'UTC',
    getInputData: () => [{ json: {} }],
    getNodeParameter: (name, _i, fallback) => (name in params ? params[name] : fallback),
    getCredentials: async () => ({ serverUrl: 'http://localhost:2785' }),
    continueOnFail: () => false,
    getNode: () => ({
      id: 'node-1',
      name: 'OpenWA',
      type: 'n8n-nodes-openwa.openWa',
      typeVersion: 2,
      position: [0, 0],
      parameters: {},
    }),
    helpers: {
      httpRequestWithAuthentication: async (_cred, options) => {
        calls.push(options);
        return {};
      },
    },
  };
}

const base = { resource: 'message', sessionId: 'abc-123', chatId: '628123456789@c.us' };
const send = (params) => {
  const ctx = makeCtx({ ...base, ...params });
  return { ctx, done: new OpenWa().execute.call(ctx) };
};
const refused = async (params, field) => {
  const { ctx, done } = send(params);
  await assert.rejects(done, (error) => new RegExp(field, 'i').test(error.message));
  assert.equal(ctx.calls.length, 0, 'nothing may reach the wire');
};
const sent = async (params) => {
  const { ctx, done } = send(params);
  await done;
  assert.equal(ctx.calls.length, 1);
  return ctx.calls[0].body;
};

const MENTION_OPERATIONS = [
  ['sendText', { message: 'hi @628123456789' }],
  ['reply', { message: 'hi', quotedMessageId: 'm1' }],
  ['edit', { message: 'hi', messageId: 'm1' }],
  ['sendImage', { imageSource: 'url', imageUrl: 'https://example.test/a.png' }],
];

for (const [operation, fields] of MENTION_OPERATIONS) {
  test(`${operation} sends domain-qualified mentions as they are`, async () => {
    const ids = [
      '628123456789@c.us',
      '628987654321@s.whatsapp.net',
      '628123456789:12@c.us',
      '12345678901234@lid',
    ];
    const body = await sent({ ...fields, operation, mentions: ids.join(', ') });
    assert.deepEqual(body.mentions, ids);
  });

  for (const bad of ['628123456789', '@628123456789', '+628123456789', '628123456789@c.us, 628987654321']) {
    test(`${operation} refuses ${JSON.stringify(bad)} as a mention and names the field`, async () => {
      await refused({ ...fields, operation, mentions: bad }, 'mention');
    });
  }
}

test('a mention the gateway would refuse for its number part is still left to the gateway', async () => {
  const body = await sent({ operation: 'sendText', message: 'hi', mentions: 'abc@c.us, 123@c.us' });
  assert.deepEqual(body.mentions, ['abc@c.us', '123@c.us']);
});

test('no mentions sends none', async () => {
  const body = await sent({ operation: 'sendText', message: 'hi', mentions: '' });
  assert.equal('mentions' in body, false);
});

const react = { operation: 'react', messageId: 'm1' };

test('react sends the emoji, an empty emoji (removes the reaction) and a plain number unchanged', async () => {
  assert.equal((await sent({ ...react, emoji: '\u{1F44D}' })).emoji, '\u{1F44D}');
  assert.equal((await sent({ ...react, emoji: '' })).emoji, '');
  assert.equal((await sent({ ...react, emoji: 5 })).emoji, 5);
  assert.equal((await sent({ ...react, emoji: true })).emoji, true);
});

test('react leaves a null emoji as it is, not as an empty one that would remove the reaction', async () => {
  const body = await sent({ ...react, emoji: null });
  assert.equal(body.emoji, null);
});

test('react refuses an object emoji and names the field', async () => {
  await refused({ ...react, emoji: { a: 1 } }, 'emoji');
});

test('react leaves a date value alone, which stringifies to something real', async () => {
  const body = await sent({ ...react, emoji: new Date('2026-10-25T00:00:00Z') });
  assert.ok(body.emoji instanceof Date);
});

const image = { operation: 'sendImage', imageSource: 'base64', imageBase64: 'SU1HREFUQQ==' };

test('a base64 send passes the MIME type through, including values that are not a real type', async () => {
  assert.equal((await sent({ ...image, imageMimeType: 'image/png' })).mimetype, 'image/png');
  assert.equal((await sent({ ...image, imageMimeType: true })).mimetype, true);
  assert.equal((await sent({ ...image, imageMimeType: '' })).mimetype, '');
});

test('a base64 send refuses an object MIME type and names the field', async () => {
  await refused({ ...image, imageMimeType: {} }, 'mime');
});
