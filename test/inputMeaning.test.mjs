import test from 'node:test';
import assert from 'node:assert/strict';

// Imports the compiled output, so run `npm run build` before this test.
import * as nodeModule from '../dist/nodes/OpenWa/OpenWa.node.js';
import { webhookSecretProblem } from '../dist/nodes/shared/webhookSecret.js';
import { sanitizePathParam } from '../dist/nodes/shared/sanitizePathParam.js';
import { parseBulkMessages } from '../dist/nodes/OpenWa/bulkMessages.js';

const { OpenWa } = nodeModule;
const BASE = 'http://localhost:2785';

function makeCtx(params, { binary = null, timezone = 'UTC' } = {}) {
  const calls = [];
  return {
    calls,
    getTimezone: () => timezone,
    getInputData: () => [{ json: {} }],
    getNodeParameter: (name, _i, fallback) => (name in params ? params[name] : fallback),
    getCredentials: async () => ({ serverUrl: BASE }),
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
      assertBinaryData: () => binary ?? { mimeType: 'image/png' },
      getBinaryDataBuffer: async () => Buffer.from('IMGDATA'),
      prepareBinaryData: async (buffer) => buffer,
    },
  };
}

async function run(params, opts) {
  const ctx = makeCtx({ sessionId: 'abc-123', chatId: '628123456789@c.us', ...params }, opts);
  await new OpenWa().execute.call(ctx);
  assert.equal(ctx.calls.length, 1, 'expected exactly one outgoing request');
  return ctx.calls[0];
}

async function refuses(params, pattern, opts) {
  const ctx = makeCtx({ sessionId: 'abc-123', chatId: '628123456789@c.us', ...params }, opts);
  await assert.rejects(() => new OpenWa().execute.call(ctx), pattern);
  assert.equal(ctx.calls.length, 0, 'a refused item must not reach the gateway');
}

const list = (messageListOptions) => ({
  resource: 'message',
  operation: 'list',
  messageListOptions,
});

// --- Message > List: the gateway's own timestamps are Unix seconds ------------------

for (const key of ['since', 'until']) {
  for (const value of [1700000000, '1700000000', 99999999999, '1.7e9']) {
    test(`message list refuses ${JSON.stringify(value)} as ${key}, which is epoch seconds`, async () => {
      await refuses(list({ [key]: value }), new RegExp(`${key} looks like epoch seconds`));
    });
  }
}

test('message list still takes zero and exact milliseconds as time bounds', async () => {
  assert.deepEqual((await run(list({ since: 0 }))).qs, { since: 0 });
  assert.deepEqual((await run(list({ since: '1700000000000', until: 1800000000000 }))).qs, {
    since: 1700000000000,
    until: 1800000000000,
  });
});

// --- Dates: an impossible day is refused instead of rolling into the next month -----

const IMPOSSIBLE_DAYS = [
  '2026-02-30',
  '2026-02-29',
  '2026-04-31',
  '2026-02-30T10:00:00',
  '2099-11-31T10:00:00Z',
];
const DATE_FIELDS = [
  ['chat mute until', (v) => ({ resource: 'chat', operation: 'mute', muteUntil: v })],
  ['call link start', (v) => ({ resource: 'call', operation: 'createLink', callLinkStartTime: v })],
  [
    'search date from',
    (v) => ({
      resource: 'system',
      operation: 'search',
      searchQuery: 'x',
      searchFilters: { dateFrom: v },
    }),
  ],
  ['message list since', (v) => list({ since: v })],
  [
    'api key expiry',
    (v) => ({ resource: 'apiKey', operation: 'create', keyName: 'k', keyFields: { expiresAt: v } }),
  ],
];
for (const [label, build] of DATE_FIELDS) {
  for (const value of IMPOSSIBLE_DAYS) {
    test(`${label} refuses ${value}`, async () => {
      await refuses(build(value), /is not a valid date|Expiry date is not a valid date/);
    });
  }
}

test('real calendar days still convert in the workflow timezone, leap day included', async () => {
  const jakarta = { timezone: 'Asia/Jakarta' };
  assert.equal(
    (await run(list({ since: '2028-02-29T09:00:00' }), jakarta)).qs.since,
    Date.UTC(2028, 1, 29, 2),
  );
  assert.equal(
    (await run(list({ since: '2026-04-30' }), jakarta)).qs.since,
    Date.UTC(2026, 3, 29, 17),
  );
  assert.equal(
    (await run(list({ since: '2026-01-31T00:00:00Z' }))).qs.since,
    Date.UTC(2026, 0, 31),
  );
});

// --- Lists: a bracketed list that is not JSON is refused, not split on its commas ---

const poll = (pollOptions) => ({
  resource: 'message',
  operation: 'sendPoll',
  pollName: 'Lunch?',
  pollOptions,
});

for (const value of [
  "['Pizza', 'Sushi']",
  '[Pizza, Sushi]',
  '["Pizza", "Sushi",]',
  '[Pizza,\nSushi]',
]) {
  test(`poll options refuse ${JSON.stringify(value)} instead of posting its brackets`, async () => {
    await refuses(poll(value), /Options looks like a JSON array but is not valid JSON/);
  });
}

test('a list that merely contains brackets keeps being split on its separators', async () => {
  for (const [value, expected] of [
    ['[Option A], [Option B]', ['[Option A]', '[Option B]']],
    ['[Urgent] foo, bar', ['[Urgent] foo', 'bar']],
    ['["Pizza", "Sushi"]', ['Pizza', 'Sushi']],
    ['Pizza, Sushi', ['Pizza', 'Sushi']],
  ]) {
    assert.deepEqual((await run(poll(value))).body.options, expected);
  }
});

test('the refusal names the field of whichever list it came from', async () => {
  await refuses(
    {
      resource: 'group',
      operation: 'addParticipants',
      groupId: 'g@g.us',
      groupParticipants: '[1@c.us,2@c.us]',
    },
    /Participants looks like a JSON array/,
  );
});

// --- NaN and Infinity are not text ---------------------------------------------------

for (const value of [NaN, Infinity, -Infinity]) {
  test(`Send Text refuses ${value} instead of sending it as a word`, async () => {
    await refuses(
      { resource: 'message', operation: 'sendText', message: value },
      /Message is not a valid number/,
    );
  });
  test(`a text field refuses ${value}`, async () => {
    await refuses(
      {
        resource: 'message',
        operation: 'sendContact',
        contactName: value,
        contactNumber: '628123456789',
      },
      /Contact name is not a valid number/,
    );
  });
}

test('a poll option that is NaN is refused', async () => {
  await refuses(poll([NaN, 'No']), /Options entry is not a valid number/);
});

test('ordinary numbers still read as text', async () => {
  assert.equal(
    (await run({ resource: 'message', operation: 'sendText', message: 0 })).body.text,
    '0',
  );
  assert.equal(
    (await run({ resource: 'message', operation: 'sendText', message: -0.5 })).body.text,
    '-0.5',
  );
});

// --- Send Text and Reply: nothing to say, or more than the gateway takes -------------

for (const operation of ['sendText', 'reply']) {
  const message = (value) => ({
    resource: 'message',
    operation,
    quotedMessageId: 'q1',
    message: value,
  });
  for (const value of ['', '   ', '\n\t', null, undefined]) {
    test(`${operation} refuses a message of ${JSON.stringify(value)}`, async () => {
      await refuses(message(value), /Message cannot be empty/);
    });
  }
  test(`${operation} counts the 4096 cap as the gateway does`, async () => {
    assert.equal((await run(message('a'.repeat(4096)))).body.text.length, 4096);
    assert.equal((await run(message('😀'.repeat(4096)))).body.text.length, 8192);
    assert.equal((await run(message('❤️'.repeat(4096)))).body.text.length, 8192);
    await refuses(message('a'.repeat(4097)), /Message cannot exceed 4096 characters/);
    await refuses(message('😀'.repeat(4097)), /Message cannot exceed 4096 characters/);
  });
  test(`${operation} keeps the whitespace around a message`, async () => {
    assert.equal((await run(message('  hi\n'))).body.text, '  hi\n');
  });
}

for (const [operation, fields] of [
  ['sendImage', { imageSource: 'url', imageUrl: 'https://example.test/a.png' }],
  ['sendVideo', { videoSource: 'url', videoUrl: 'https://example.test/a.mp4' }],
  ['sendDocument', { documentSource: 'url', documentUrl: 'https://example.test/a.pdf' }],
]) {
  test(`${operation} counts the 1024 caption cap`, async () => {
    const base = { resource: 'message', operation, ...fields };
    assert.equal((await run({ ...base, caption: 'a'.repeat(1024) })).body.caption.length, 1024);
    await refuses({ ...base, caption: 'a'.repeat(1025) }, /Caption cannot exceed 1024 characters/);
  });
}

test('a poll option longer than 100 characters is refused by name', async () => {
  assert.equal((await run(poll(['a'.repeat(100), 'b']))).body.options[0].length, 100);
  await refuses(poll(['a'.repeat(101), 'b']), /Each poll option cannot exceed 100 characters/);
});

test('Send Bulk names the field when Messages is blank or not JSON', async () => {
  for (const value of ['', '   ', '{not json']) {
    await refuses(
      { resource: 'message', operation: 'sendBulk', bulkMessages: value },
      /Messages must be valid JSON/,
    );
  }
  assert.throws(() => parseBulkMessages(''), /Messages must be valid JSON/);
});

// --- Profile and group pictures must be images ---------------------------------------

const PICTURE = [
  ['profile', { resource: 'profile', operation: 'setPicture' }, 'profilePicture'],
  [
    'group',
    { resource: 'group', operation: 'setPicture', groupId: '120363021234567890@g.us' },
    'groupPicture',
  ],
];
for (const [label, base, prefix] of PICTURE) {
  test(`${label} picture refuses a binary item that is not an image`, async () => {
    const params = { ...base, [`${prefix}Source`]: 'binary', [`${prefix}BinaryProperty`]: 'data' };
    await refuses(
      params,
      /Picture must be an image, but its MIME type is "application\/octet-stream"/,
      {
        binary: { mimeType: 'application/octet-stream' },
      },
    );
    const ok = await run(params, { binary: { mimeType: 'image/png' } });
    assert.equal(ok.body.mimetype, 'image/png');
    assert.equal((await run(params, { binary: { mimeType: '' } })).body.mimetype, 'image/jpeg');
  });
  test(`${label} picture checks the MIME type typed beside Base64 and leaves a URL alone`, async () => {
    const b64 = { ...base, [`${prefix}Source`]: 'base64', [`${prefix}Base64`]: 'SU1H' };
    await refuses({ ...b64, [`${prefix}MimeType`]: 'application/pdf' }, /Picture must be an image/);
    assert.equal(
      (await run({ ...b64, [`${prefix}MimeType`]: 'image/webp' })).body.mimetype,
      'image/webp',
    );
    const url = await run({
      ...base,
      [`${prefix}Source`]: 'url',
      [`${prefix}Url`]: 'https://example.test/a.jpg',
    });
    assert.deepEqual(url.body, { url: 'https://example.test/a.jpg' });
  });
}

// --- Path parameters ------------------------------------------------------------------

test('a path parameter that has no text form is refused by name, not sent as "[object Object]"', () => {
  assert.throws(() => sanitizePathParam({}, 'Session ID'), /Session ID must be text/);
  assert.throws(() => sanitizePathParam(new Map(), 'Webhook ID'), /Webhook ID must be text/);
  assert.throws(() => sanitizePathParam(NaN, 'Label ID'), /Label ID is not a valid number/);
  assert.throws(
    () => sanitizePathParam('half\uD800', 'Call ID'),
    /Call ID contains invalid characters/,
  );
});

test('a path parameter that reads as text is unchanged', () => {
  assert.equal(sanitizePathParam(12, 'Label ID'), '12');
  assert.equal(sanitizePathParam(['a'], 'Label ID'), 'a');
  assert.equal(sanitizePathParam(' abc-123 ', 'Session ID'), 'abc-123');
  assert.equal(sanitizePathParam('a b', 'Session ID'), 'a%20b');
  assert.throws(() => sanitizePathParam('a/b', 'Session ID'), /invalid characters/);
});

// --- Webhook secret length is counted as the gateway counts it ------------------------

test('the secret floor counts a surrogate pair once and the ceiling counts code points', () => {
  const emoji = (n) => '😀'.repeat(n);
  assert.match(webhookSecretProblem(emoji(8)), /at least 16 characters/);
  assert.equal(webhookSecretProblem(emoji(16)), null);
  assert.equal(webhookSecretProblem(emoji(128)), null);
  assert.equal(webhookSecretProblem(emoji(255)), null);
  assert.match(webhookSecretProblem(emoji(256)), /cannot exceed 255 characters/);
  // A presentation selector is a code point of its own for the ceiling.
  assert.equal(webhookSecretProblem('❤️'.repeat(127)), null);
  assert.match(webhookSecretProblem('❤️'.repeat(128)), /cannot exceed 255 characters/);
  assert.match(webhookSecretProblem('a'.repeat(15)), /at least 16/);
  assert.equal(webhookSecretProblem('a'.repeat(16)), null);
  assert.equal(webhookSecretProblem('a'.repeat(255)), null);
  assert.match(webhookSecretProblem('a'.repeat(256)), /cannot exceed 255/);
  assert.equal(webhookSecretProblem(''), null);
});

const webhookCreate = (extra) => ({
  resource: 'webhook',
  operation: 'create',
  events: ['message.received'],
  webhookUrl: 'https://n8n.example/hook',
  ...extra,
});

test('Webhook Create reads the URL and the events as Update does', async () => {
  assert.equal(
    (await run(webhookCreate({ webhookUrl: ' https://n8n.example/hook\n' }))).body.url,
    'https://n8n.example/hook',
  );
  assert.deepEqual(
    (await run(webhookCreate({ events: 'message.received, message.sent' }))).body.events,
    ['message.received', 'message.sent'],
  );
  assert.deepEqual((await run(webhookCreate({ events: '["message.received"]' }))).body.events, [
    'message.received',
  ]);
  assert.deepEqual((await run(webhookCreate({ events: '*' }))).body.events, ['*']);
  assert.deepEqual((await run(webhookCreate({ events: ['a', 'b'] }))).body.events, ['a', 'b']);
  await refuses(webhookCreate({ events: [] }), /At least one event must be selected/);
  for (const events of ['', ' ', 0, false, null, undefined]) {
    await refuses(webhookCreate({ events }), /At least one event must be selected/);
  }
  for (const webhookUrl of ['', '  ', null, undefined]) {
    await refuses(webhookCreate({ webhookUrl }), /URL cannot be empty/);
  }
});

test('Webhook Update reads a text list of events as a list', async () => {
  const update = (updateFields) => ({
    resource: 'webhook',
    operation: 'update',
    webhookId: 'w1',
    updateFields,
  });
  assert.deepEqual((await run(update({ events: 'message.received,message.sent' }))).body.events, [
    'message.received',
    'message.sent',
  ]);
  await refuses(update({ events: '' }), /At least one event must be selected/);
});

test('Webhook Update applies a secret that is a number instead of skipping it', async () => {
  const update = (updateFields) => ({
    resource: 'webhook',
    operation: 'update',
    webhookId: 'w1',
    updateFields,
  });
  const sent = await run(update({ secret: 1234567890123456, active: true }));
  assert.deepEqual(sent.body, { active: true, secret: '1234567890123456' });
  await refuses(update({ secret: 12345 }), /at least 16 characters/);
});

test('a webhook secret is never trimmed, on Create or Update', async () => {
  const secret = '  a-secret-with-spaces  ';
  assert.equal((await run(webhookCreate({ webhookSecret: secret }))).body.secret, secret);
  const update = await run({
    resource: 'webhook',
    operation: 'update',
    webhookId: 'w1',
    updateFields: { secret },
  });
  assert.equal(update.body.secret, secret);
});
