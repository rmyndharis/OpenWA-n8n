import test from 'node:test';
import assert from 'node:assert/strict';

// Imports the compiled output, so run `npm run build` before this test.
import * as nodeModule from '../dist/nodes/OpenWa/OpenWa.node.js';

const { OpenWa } = nodeModule;

const BASE = 'http://localhost:2785';
// base64 of the fake binary buffer 'IMGDATA' returned by getBinaryDataBuffer.
const IMG_B64 = 'SU1HREFUQQ==';

// Plain fake `this` for the action node — same style as webhookLifecycle.test.mjs.
// Captures every outgoing request so tests can assert method + URL + body.
function makeCtx({
  params = {},
  response = {},
  throwErr = null,
  continueOnFail = false,
  binary = null,
} = {}) {
  const calls = [];
  const ctx = {
    calls,
    getInputData: () => [{ json: {} }],
    getNodeParameter: (name, _i, fallback) => (name in params ? params[name] : fallback),
    getCredentials: async () => ({ serverUrl: BASE }),
    continueOnFail: () => continueOnFail,
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
        if (throwErr) throw throwErr;
        return response;
      },
      assertBinaryData: () => binary ?? { mimeType: 'image/png' },
      getBinaryDataBuffer: async () => Buffer.from('IMGDATA'),
    },
  };
  return ctx;
}

async function run(params, opts = {}) {
  const ctx = makeCtx({ ...opts, params });
  const output = await new OpenWa().execute.call(ctx);
  return { ctx, output };
}

function singleCall(ctx) {
  assert.equal(ctx.calls.length, 1, 'expected exactly one outgoing request');
  return ctx.calls[0];
}

// --- Happy-path mapping: one entry per operation variant -------------------
// [label, params, expectedMethod, expectedUrl, expectedBody]
// expectedBody === undefined asserts that NO request body was sent.
const mappingCases = [
  // ---- session ----
  [
    'session/create (name trimmed, no config)',
    { resource: 'session', operation: 'create', sessionName: '  my-session ' },
    'POST',
    `${BASE}/api/sessions`,
    { name: 'my-session' },
  ],
  [
    'session/create with a JSON-string config',
    {
      resource: 'session',
      operation: 'create',
      sessionName: 'my-session',
      sessionConfig: '{"autoReconnect":true}',
    },
    'POST',
    `${BASE}/api/sessions`,
    { name: 'my-session', config: { autoReconnect: true } },
  ],
  [
    'session/create with an already-parsed config object',
    {
      resource: 'session',
      operation: 'create',
      sessionName: 'my-session',
      sessionConfig: { autoReconnect: true },
    },
    'POST',
    `${BASE}/api/sessions`,
    { name: 'my-session', config: { autoReconnect: true } },
  ],
  [
    'session/listAll',
    { resource: 'session', operation: 'listAll' },
    'GET',
    `${BASE}/api/sessions`,
    undefined,
  ],
  [
    'session/getStatus',
    { resource: 'session', operation: 'getStatus', sessionId: 'abc-123' },
    'GET',
    `${BASE}/api/sessions/abc-123`,
    undefined,
  ],
  [
    'session/start',
    { resource: 'session', operation: 'start', sessionId: 'abc-123' },
    'POST',
    `${BASE}/api/sessions/abc-123/start`,
    undefined,
  ],
  [
    'session/stop',
    { resource: 'session', operation: 'stop', sessionId: 'abc-123' },
    'POST',
    `${BASE}/api/sessions/abc-123/stop`,
    undefined,
  ],
  [
    'session/forceKill',
    { resource: 'session', operation: 'forceKill', sessionId: 'abc-123' },
    'POST',
    `${BASE}/api/sessions/abc-123/force-kill`,
    undefined,
  ],
  [
    'session/delete',
    { resource: 'session', operation: 'delete', sessionId: 'abc-123' },
    'DELETE',
    `${BASE}/api/sessions/abc-123`,
    undefined,
  ],
  [
    'session/getQr',
    { resource: 'session', operation: 'getQr', sessionId: 'abc-123' },
    'GET',
    `${BASE}/api/sessions/abc-123/qr`,
    undefined,
  ],
  [
    'session/requestPairingCode strips "+", spaces and dashes',
    {
      resource: 'session',
      operation: 'requestPairingCode',
      sessionId: 'abc-123',
      pairingPhoneNumber: '+62 812-3456-789',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/pairing-code`,
    { phoneNumber: '628123456789' },
  ],

  // ---- message: text / mentions ----
  [
    'message/sendText',
    {
      resource: 'message',
      operation: 'sendText',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      message: 'hello',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-text`,
    { chatId: '1@c.us', text: 'hello' },
  ],
  [
    'message/sendText with mentions (trimmed, blanks dropped)',
    {
      resource: 'message',
      operation: 'sendText',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      message: 'hi @628',
      mentions: [' 628@c.us ', ''],
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-text`,
    { chatId: '1@c.us', text: 'hi @628', mentions: ['628@c.us'] },
  ],
  [
    'message/sendText ignores an all-blank mentions list',
    {
      resource: 'message',
      operation: 'sendText',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      message: 'hi',
      mentions: ['', '   '],
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-text`,
    { chatId: '1@c.us', text: 'hi' },
  ],

  // ---- message: sendImage ----
  [
    'message/sendImage from URL (blank caption omitted)',
    {
      resource: 'message',
      operation: 'sendImage',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      imageSource: 'url',
      imageUrl: 'https://x/a.jpg',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-image`,
    { chatId: '1@c.us', url: 'https://x/a.jpg' },
  ],
  [
    'message/sendImage from URL with trimmed caption',
    {
      resource: 'message',
      operation: 'sendImage',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      imageSource: 'url',
      imageUrl: 'https://x/a.jpg',
      caption: ' hi ',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-image`,
    { chatId: '1@c.us', caption: 'hi', url: 'https://x/a.jpg' },
  ],
  [
    'message/sendImage from base64',
    {
      resource: 'message',
      operation: 'sendImage',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      imageSource: 'base64',
      imageBase64: 'QkFTRTY0',
      imageMimeType: 'image/png',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-image`,
    { chatId: '1@c.us', base64: 'QkFTRTY0', mimetype: 'image/png' },
  ],
  [
    'message/sendImage from binary uses the binary mime type',
    {
      resource: 'message',
      operation: 'sendImage',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      imageSource: 'binary',
      imageBinaryProperty: 'data',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-image`,
    { chatId: '1@c.us', base64: IMG_B64, mimetype: 'image/png' },
  ],
  [
    'message/sendImage from binary without a mime type falls back to octet-stream',
    {
      resource: 'message',
      operation: 'sendImage',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      imageSource: 'binary',
      imageBinaryProperty: 'data',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-image`,
    { chatId: '1@c.us', base64: IMG_B64, mimetype: 'application/octet-stream' },
    { binary: { mimeType: '' } },
  ],

  // ---- message: sendVideo ----
  [
    'message/sendVideo from URL',
    {
      resource: 'message',
      operation: 'sendVideo',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      videoSource: 'url',
      videoUrl: 'https://x/v.mp4',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-video`,
    { chatId: '1@c.us', url: 'https://x/v.mp4' },
  ],
  [
    'message/sendVideo from base64',
    {
      resource: 'message',
      operation: 'sendVideo',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      videoSource: 'base64',
      videoBase64: 'QkFTRTY0',
      videoMimeType: 'video/mp4',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-video`,
    { chatId: '1@c.us', base64: 'QkFTRTY0', mimetype: 'video/mp4' },
  ],
  [
    'message/sendVideo from binary without a mime type falls back to octet-stream',
    {
      resource: 'message',
      operation: 'sendVideo',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      videoSource: 'binary',
      videoBinaryProperty: 'data',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-video`,
    { chatId: '1@c.us', base64: IMG_B64, mimetype: 'application/octet-stream' },
    { binary: { mimeType: '' } },
  ],

  // ---- message: sendDocument ----
  [
    'message/sendDocument from URL uses the default filename',
    {
      resource: 'message',
      operation: 'sendDocument',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      documentSource: 'url',
      documentUrl: 'https://x/f.pdf',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-document`,
    { chatId: '1@c.us', filename: 'document.pdf', url: 'https://x/f.pdf' },
  ],
  [
    'message/sendDocument from base64 with a custom filename',
    {
      resource: 'message',
      operation: 'sendDocument',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      documentSource: 'base64',
      documentBase64: 'QkFTRTY0',
      documentMimeType: 'application/pdf',
      filename: 'report.pdf',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-document`,
    {
      chatId: '1@c.us',
      filename: 'report.pdf',
      base64: 'QkFTRTY0',
      mimetype: 'application/pdf',
    },
  ],
  [
    'message/sendDocument from binary without a mime type falls back to octet-stream',
    {
      resource: 'message',
      operation: 'sendDocument',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      documentSource: 'binary',
      documentBinaryProperty: 'data',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-document`,
    { chatId: '1@c.us', filename: 'document.pdf', base64: IMG_B64, mimetype: 'application/octet-stream' },
    { binary: { mimeType: '' } },
  ],

  // ---- message: sendAudio ----
  [
    'message/sendAudio from URL (no ptt flag when voice note off)',
    {
      resource: 'message',
      operation: 'sendAudio',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      audioSource: 'url',
      audioUrl: 'https://x/a.mp3',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-audio`,
    { chatId: '1@c.us', url: 'https://x/a.mp3' },
  ],
  [
    'message/sendAudio from URL as a voice note sets ptt',
    {
      resource: 'message',
      operation: 'sendAudio',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      audioSource: 'url',
      audioUrl: 'https://x/a.ogg',
      sendAsVoiceNote: true,
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-audio`,
    { chatId: '1@c.us', url: 'https://x/a.ogg', ptt: true },
  ],
  [
    'message/sendAudio from base64',
    {
      resource: 'message',
      operation: 'sendAudio',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      audioSource: 'base64',
      audioBase64: 'QkFTRTY0',
      audioMimeType: 'audio/mpeg',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-audio`,
    { chatId: '1@c.us', base64: 'QkFTRTY0', mimetype: 'audio/mpeg' },
  ],
  [
    'message/sendAudio from binary without a mime type falls back to ogg/opus',
    {
      resource: 'message',
      operation: 'sendAudio',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      audioSource: 'binary',
      audioBinaryProperty: 'data',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-audio`,
    { chatId: '1@c.us', base64: IMG_B64, mimetype: 'audio/ogg; codecs=opus' },
    { binary: { mimeType: '' } },
  ],

  // ---- message: sendSticker ----
  [
    'message/sendSticker from URL',
    {
      resource: 'message',
      operation: 'sendSticker',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      stickerSource: 'url',
      stickerUrl: 'https://x/s.webp',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-sticker`,
    { chatId: '1@c.us', url: 'https://x/s.webp' },
  ],
  [
    'message/sendSticker from base64',
    {
      resource: 'message',
      operation: 'sendSticker',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      stickerSource: 'base64',
      stickerBase64: 'QkFTRTY0',
      stickerMimeType: 'image/webp',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-sticker`,
    { chatId: '1@c.us', base64: 'QkFTRTY0', mimetype: 'image/webp' },
  ],
  [
    'message/sendSticker from binary without a mime type falls back to image/webp',
    {
      resource: 'message',
      operation: 'sendSticker',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      stickerSource: 'binary',
      stickerBinaryProperty: 'data',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-sticker`,
    { chatId: '1@c.us', base64: IMG_B64, mimetype: 'image/webp' },
    { binary: { mimeType: '' } },
  ],
];

// --- Remaining mapping cases (appended to the same table) ---
mappingCases.push(
  // ---- message: sendLocation / sendContact ----
  [
    'message/sendLocation (blank name omitted)',
    {
      resource: 'message',
      operation: 'sendLocation',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      latitude: -6.2,
      longitude: 106.8,
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-location`,
    { chatId: '1@c.us', latitude: -6.2, longitude: 106.8 },
  ],
  [
    'message/sendLocation maps the name to `description` (trimmed)',
    {
      resource: 'message',
      operation: 'sendLocation',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      latitude: -6.2,
      longitude: 106.8,
      locationName: ' Office ',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-location`,
    { chatId: '1@c.us', latitude: -6.2, longitude: 106.8, description: 'Office' },
  ],
  [
    'message/sendLocation never carries mentions',
    {
      resource: 'message',
      operation: 'sendLocation',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      latitude: -6.2,
      longitude: 106.8,
      mentions: ['628@c.us'],
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-location`,
    { chatId: '1@c.us', latitude: -6.2, longitude: 106.8 },
  ],
  [
    'message/sendContact trims name and number',
    {
      resource: 'message',
      operation: 'sendContact',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      contactName: ' John ',
      contactNumber: ' +62812 ',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-contact`,
    { chatId: '1@c.us', contactName: 'John', contactNumber: '+62812' },
  ],

  // ---- message: reply / react / delete ----
  [
    'message/reply trims the quoted message id',
    {
      resource: 'message',
      operation: 'reply',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      quotedMessageId: ' true_1@c.us_3EB0 ',
      message: 'balas',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/reply`,
    { chatId: '1@c.us', quotedMessageId: 'true_1@c.us_3EB0', text: 'balas' },
  ],
  [
    'message/react with an emoji',
    {
      resource: 'message',
      operation: 'react',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      messageId: ' true_1@c.us_3EB0 ',
      emoji: '👍',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/react`,
    { chatId: '1@c.us', messageId: 'true_1@c.us_3EB0', emoji: '👍' },
  ],
  [
    'message/react sends the empty emoji (removes the reaction)',
    {
      resource: 'message',
      operation: 'react',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      messageId: 'm1',
      emoji: '',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/react`,
    { chatId: '1@c.us', messageId: 'm1', emoji: '' },
  ],
  [
    'message/delete defaults to forEveryone=true',
    {
      resource: 'message',
      operation: 'delete',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      messageId: 'm1',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/delete`,
    { chatId: '1@c.us', messageId: 'm1', forEveryone: true },
  ],
  [
    'message/delete with forEveryone=false',
    {
      resource: 'message',
      operation: 'delete',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      messageId: 'm1',
      forEveryone: false,
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/delete`,
    { chatId: '1@c.us', messageId: 'm1', forEveryone: false },
  ],

  // ---- message: bulk / batch ----
  [
    'message/sendBulk minimal (no batchId, no options)',
    {
      resource: 'message',
      operation: 'sendBulk',
      sessionId: 'abc-123',
      bulkMessages: '[{"chatId":"1@c.us","type":"text","content":{"text":"hi"}}]',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-bulk`,
    { messages: [{ chatId: '1@c.us', type: 'text', content: { text: 'hi' } }] },
  ],
  [
    'message/sendBulk with a trimmed batchId and options',
    {
      resource: 'message',
      operation: 'sendBulk',
      sessionId: 'abc-123',
      bulkMessages: [{ chatId: '1@c.us', type: 'text', content: { text: 'hi' } }],
      batchId: ' b1 ',
      bulkOptions: { delayBetweenMessages: 5000, randomizeDelay: false },
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/send-bulk`,
    {
      messages: [{ chatId: '1@c.us', type: 'text', content: { text: 'hi' } }],
      batchId: 'b1',
      options: { delayBetweenMessages: 5000, randomizeDelay: false },
    },
  ],
  [
    'message/getBatchStatus',
    {
      resource: 'message',
      operation: 'getBatchStatus',
      sessionId: 'abc-123',
      statusBatchId: 'b1',
    },
    'GET',
    `${BASE}/api/sessions/abc-123/messages/batch/b1`,
    undefined,
  ],
  [
    'message/cancelBatch',
    {
      resource: 'message',
      operation: 'cancelBatch',
      sessionId: 'abc-123',
      statusBatchId: 'b1',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/messages/batch/b1/cancel`,
    undefined,
  ],

  // ---- contact ----
  [
    'contact/checkExists strips formatting and encodes the number',
    {
      resource: 'contact',
      operation: 'checkExists',
      sessionId: 'abc-123',
      phoneNumber: ' +62 812-3456 ',
    },
    'GET',
    `${BASE}/api/sessions/abc-123/contacts/check/628123456`,
    undefined,
  ],
  [
    'contact/getInfo URL-encodes the contact id',
    {
      resource: 'contact',
      operation: 'getInfo',
      sessionId: 'abc-123',
      contactId: '1@c.us',
    },
    'GET',
    `${BASE}/api/sessions/abc-123/contacts/1%40c.us`,
    undefined,
  ],
  [
    'contact/getProfilePicture',
    {
      resource: 'contact',
      operation: 'getProfilePicture',
      sessionId: 'abc-123',
      contactId: '1@c.us',
    },
    'GET',
    `${BASE}/api/sessions/abc-123/contacts/1%40c.us/profile-picture`,
    undefined,
  ],
  [
    'contact/getPhone',
    {
      resource: 'contact',
      operation: 'getPhone',
      sessionId: 'abc-123',
      contactId: '1@c.us',
    },
    'GET',
    `${BASE}/api/sessions/abc-123/contacts/1%40c.us/phone`,
    undefined,
  ],
  [
    'contact/block',
    {
      resource: 'contact',
      operation: 'block',
      sessionId: 'abc-123',
      contactId: '1@c.us',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/contacts/1%40c.us/block`,
    undefined,
  ],
  [
    'contact/unblock is a DELETE on the block endpoint',
    {
      resource: 'contact',
      operation: 'unblock',
      sessionId: 'abc-123',
      contactId: '1@c.us',
    },
    'DELETE',
    `${BASE}/api/sessions/abc-123/contacts/1%40c.us/block`,
    undefined,
  ],

  // ---- webhook ----
  [
    'webhook/create without a secret',
    {
      resource: 'webhook',
      operation: 'create',
      sessionId: 'abc-123',
      webhookUrl: 'https://n8n.example/hook',
      events: ['message.received'],
    },
    'POST',
    `${BASE}/api/sessions/abc-123/webhooks`,
    { url: 'https://n8n.example/hook', events: ['message.received'] },
  ],
  [
    'webhook/create with a secret',
    {
      resource: 'webhook',
      operation: 'create',
      sessionId: 'abc-123',
      webhookUrl: 'https://n8n.example/hook',
      events: ['message.received'],
      webhookSecret: 's3cr3t',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/webhooks`,
    { url: 'https://n8n.example/hook', events: ['message.received'], secret: 's3cr3t' },
  ],
  [
    'webhook/update forwards only the fields that were set (url only)',
    {
      resource: 'webhook',
      operation: 'update',
      sessionId: 'abc-123',
      webhookId: 'w1',
      updateFields: { url: 'https://n8n.example/new' },
    },
    'PUT',
    `${BASE}/api/sessions/abc-123/webhooks/w1`,
    { url: 'https://n8n.example/new' },
  ],
  [
    'webhook/update forwards a non-empty events list',
    {
      resource: 'webhook',
      operation: 'update',
      sessionId: 'abc-123',
      webhookId: 'w1',
      updateFields: { events: ['message.received', 'session.status'] },
    },
    'PUT',
    `${BASE}/api/sessions/abc-123/webhooks/w1`,
    { events: ['message.received', 'session.status'] },
  ],
  [
    'webhook/update with retryCount and active=false',
    {
      resource: 'webhook',
      operation: 'update',
      sessionId: 'abc-123',
      webhookId: 'w1',
      updateFields: { retryCount: 5, active: false },
    },
    'PUT',
    `${BASE}/api/sessions/abc-123/webhooks/w1`,
    { retryCount: 5, active: false },
  ],
  [
    'webhook/update never sends an empty secret',
    {
      resource: 'webhook',
      operation: 'update',
      sessionId: 'abc-123',
      webhookId: 'w1',
      updateFields: { secret: '' },
    },
    'PUT',
    `${BASE}/api/sessions/abc-123/webhooks/w1`,
    undefined,
  ],
  [
    'webhook/update sends a non-empty secret',
    {
      resource: 'webhook',
      operation: 'update',
      sessionId: 'abc-123',
      webhookId: 'w1',
      updateFields: { secret: 'new-secret' },
    },
    'PUT',
    `${BASE}/api/sessions/abc-123/webhooks/w1`,
    { secret: 'new-secret' },
  ],
  [
    'webhook/update parses headers JSON',
    {
      resource: 'webhook',
      operation: 'update',
      sessionId: 'abc-123',
      webhookId: 'w1',
      updateFields: { headers: '{"X-Team":"ops"}' },
    },
    'PUT',
    `${BASE}/api/sessions/abc-123/webhooks/w1`,
    { headers: { 'X-Team': 'ops' } },
  ],
  [
    "webhook/update treats filters 'null' as an explicit clear",
    {
      resource: 'webhook',
      operation: 'update',
      sessionId: 'abc-123',
      webhookId: 'w1',
      updateFields: { filters: 'null' },
    },
    'PUT',
    `${BASE}/api/sessions/abc-123/webhooks/w1`,
    { filters: null },
  ],
  [
    'webhook/delete',
    {
      resource: 'webhook',
      operation: 'delete',
      sessionId: 'abc-123',
      webhookId: 'w1',
    },
    'DELETE',
    `${BASE}/api/sessions/abc-123/webhooks/w1`,
    undefined,
  ],
  [
    'webhook/test',
    {
      resource: 'webhook',
      operation: 'test',
      sessionId: 'abc-123',
      webhookId: 'w1',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/webhooks/w1/test`,
    undefined,
  ],
);

for (const [label, params, method, url, body, opts] of mappingCases) {
  test(`maps ${label}`, async () => {
    const { ctx } = await run(params, opts);
    const { options } = singleCall(ctx);
    assert.equal(options.method, method);
    assert.equal(options.url, url);
    if (body === undefined) {
      assert.equal(options.body, undefined);
    } else {
      assert.deepEqual(options.body, body);
    }
  });
}

// --- Request plumbing --------------------------------------------------------

test('requests are sent as JSON authenticated with the openWaApi credential', async () => {
  const { ctx } = await run({ resource: 'session', operation: 'listAll' });
  const call = singleCall(ctx);
  assert.equal(call.credName, 'openWaApi');
  assert.equal(call.options.json, true);
  assert.equal(call.options.headers['Content-Type'], 'application/json');
});

test('a successful item carries pairedItem lineage and the raw response', async () => {
  const { output } = await run(
    { resource: 'session', operation: 'listAll' },
    { response: { sessions: [] } },
  );
  assert.deepEqual(output[0][0].json, { sessions: [] });
  assert.deepEqual(output[0][0].pairedItem, { item: 0 });
});

test('a DELETE with an empty (204) response yields { success: true }', async () => {
  const { output } = await run(
    { resource: 'session', operation: 'delete', sessionId: 'abc-123' },
    { response: '' },
  );
  assert.deepEqual(output[0][0].json, { success: true });
  assert.deepEqual(output[0][0].pairedItem, { item: 0 });
});

// --- Error handling ----------------------------------------------------------

test('a validation error surfaces as a NodeOperationError', async () => {
  await assert.rejects(
    () =>
      run({
        resource: 'message',
        operation: 'sendText',
        sessionId: 'abc-123',
        chatId: '   ',
        message: 'x',
      }),
    /Chat ID cannot be empty/,
  );
});

test('continueOnFail pushes the error message and keeps the item lineage', async () => {
  const { output } = await run(
    {
      resource: 'message',
      operation: 'sendText',
      sessionId: 'abc-123',
      chatId: '',
      message: 'x',
    },
    { continueOnFail: true },
  );
  assert.equal(output[0].length, 1);
  assert.deepEqual(output[0][0].json, { error: 'Chat ID cannot be empty' });
  assert.deepEqual(output[0][0].pairedItem, { item: 0 });
});

test('an HTTP failure is wrapped in a NodeApiError', async () => {
  await assert.rejects(
    () =>
      run(
        {
          resource: 'message',
          operation: 'sendText',
          sessionId: 'abc-123',
          chatId: '1@c.us',
          message: 'x',
        },
        { throwErr: { statusCode: 500, message: 'boom' } },
      ),
    (err) => err.constructor.name === 'NodeApiError',
  );
});

// --- Input guards (table-driven: params → expected message) ------------------
const guardCases = [
  [
    'session/create rejects an empty session name',
    { resource: 'session', operation: 'create', sessionName: '  ' },
    /Session name cannot be empty/,
  ],
  [
    'session/create rejects invalid JSON config',
    {
      resource: 'session',
      operation: 'create',
      sessionName: 's1',
      sessionConfig: '{not json',
    },
    /Session config must be valid JSON/,
  ],
  [
    'session/create rejects a non-object config',
    {
      resource: 'session',
      operation: 'create',
      sessionName: 's1',
      sessionConfig: '[1,2]',
    },
    /Session config must be a JSON object/,
  ],
  [
    'session/requestPairingCode rejects a non-numeric phone',
    {
      resource: 'session',
      operation: 'requestPairingCode',
      sessionId: 'abc-123',
      pairingPhoneNumber: 'abc',
    },
    /Phone number must be 6–15 digits/,
  ],
  [
    'message operations reject an empty session id',
    { resource: 'message', operation: 'sendText', sessionId: '', chatId: '1@c.us', message: 'x' },
    /Session ID cannot be empty/,
  ],
  [
    'message/sendText rejects an empty chat id',
    { resource: 'message', operation: 'sendText', sessionId: 'abc-123', chatId: '', message: 'x' },
    /Chat ID cannot be empty/,
  ],
  [
    'message/sendBulk rejects a non-array',
    { resource: 'message', operation: 'sendBulk', sessionId: 'abc-123', bulkMessages: '{}' },
    /must be a JSON array/,
  ],
  [
    'message/sendBulk rejects an empty array',
    { resource: 'message', operation: 'sendBulk', sessionId: 'abc-123', bulkMessages: '[]' },
    /at least one item/,
  ],
  [
    'message/sendBulk rejects more than 100 items',
    {
      resource: 'message',
      operation: 'sendBulk',
      sessionId: 'abc-123',
      bulkMessages: Array.from({ length: 101 }, () => ({ chatId: '1@c.us' })),
    },
    /exceed 100 items/,
  ],
  [
    'message/getBatchStatus rejects an empty batch id',
    { resource: 'message', operation: 'getBatchStatus', sessionId: 'abc-123', statusBatchId: '' },
    /Batch ID cannot be empty/,
  ],
  [
    'contact/checkExists rejects a non-numeric phone',
    {
      resource: 'contact',
      operation: 'checkExists',
      sessionId: 'abc-123',
      phoneNumber: '62-ABC',
    },
    /must contain only digits/,
  ],
  [
    'contact/getInfo rejects an empty contact id',
    { resource: 'contact', operation: 'getInfo', sessionId: 'abc-123', contactId: '  ' },
    /Contact ID cannot be empty/,
  ],
  [
    'webhook/create rejects an empty events list',
    {
      resource: 'webhook',
      operation: 'create',
      sessionId: 'abc-123',
      webhookUrl: 'https://n8n.example/hook',
      events: [],
    },
    /At least one event must be selected/,
  ],
  [
    'webhook/update rejects an empty events list',
    {
      resource: 'webhook',
      operation: 'update',
      sessionId: 'abc-123',
      webhookId: 'w1',
      updateFields: { events: [] },
    },
    /At least one event must be selected when updating events/,
  ],
  [
    'webhook/update rejects invalid headers JSON',
    {
      resource: 'webhook',
      operation: 'update',
      sessionId: 'abc-123',
      webhookId: 'w1',
      updateFields: { headers: '{bad' },
    },
    /Headers must be valid JSON/,
  ],
  [
    'webhook/update rejects invalid filters JSON',
    {
      resource: 'webhook',
      operation: 'update',
      sessionId: 'abc-123',
      webhookId: 'w1',
      updateFields: { filters: '{bad' },
    },
    /Filters must be valid JSON/,
  ],
  [
    'an unknown resource fails with a clear message',
    { resource: 'bogus', operation: 'x' },
    /Unsupported resource\/operation: bogus\/x/,
  ],
];

for (const [label, params, pattern] of guardCases) {
  test(label, async () => {
    await assert.rejects(() => run(params), pattern);
  });
}
