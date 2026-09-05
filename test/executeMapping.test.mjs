import test from 'node:test';
import assert from 'node:assert/strict';

// Imports the compiled output, so run `npm run build` before this test.
import { createRequire } from 'node:module';
import * as nodeModule from '../dist/nodes/OpenWa/OpenWa.node.js';

// n8n-workflow ships a broken ESM build (extensionless internal imports), so the
// CJS entry is the only one that loads here. The node itself is compiled to CJS
// and resolves it the same way.
const { NodeApiError } = createRequire(import.meta.url)('n8n-workflow');

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
  throwFalsy = false,
  throwOnCall = 0,
  items = 1,
  continueOnFail = false,
  binary = null,
} = {}) {
  const calls = [];
  const prepared = [];
  const ctx = {
    calls,
    prepared,
    getInputData: () => Array.from({ length: items }, () => ({ json: {} })),
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
        // `throwFalsy` exists because the truthiness check below cannot express a
        // rejection of null or undefined, which is exactly the shape that used to
        // take the error handling down.
        // throwOnCall targets one item in a multi-item run, so a test can assert
        // which item a failure was attributed to.
        if (throwOnCall && calls.length !== throwOnCall) return response;
        if (throwFalsy) throw throwErr;
        if (throwErr) throw throwErr;
        return response;
      },
      assertBinaryData: () => binary ?? { mimeType: 'image/png' },
      getBinaryDataBuffer: async () => Buffer.from('IMGDATA'),
      // Stands in for n8n's binary-data pipeline: records what it was handed so
      // a test can assert the bytes and the served MIME type survived the round trip.
      prepareBinaryData: async (buffer, _filePath, mimeType) => {
        prepared.push({ buffer: buffer.toString('utf8'), mimeType });
        return {
          data: buffer.toString('base64'),
          mimeType: mimeType ?? 'application/octet-stream',
        };
      },
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
      webhookSecret: 'sixteen-char-secret',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/webhooks`,
    { url: 'https://n8n.example/hook', events: ['message.received'], secret: 'sixteen-char-secret' },
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
    // A collection yields the field's blank default as soon as it is added, so a
    // blank cannot be read as "clear it" without disabling signing by accident.
    'webhook/update never sends an empty secret',
    {
      resource: 'webhook',
      operation: 'update',
      sessionId: 'abc-123',
      webhookId: 'w1',
      updateFields: { secret: '', active: true },
    },
    'PUT',
    `${BASE}/api/sessions/abc-123/webhooks/w1`,
    { active: true },
  ],
  [
    // The server reads an empty secret as "stop signing", which only an explicit
    // gesture should ask for.
    'webhook/update clears the secret when asked explicitly',
    {
      resource: 'webhook',
      operation: 'update',
      sessionId: 'abc-123',
      webhookId: 'w1',
      updateFields: { clearSecret: true },
    },
    'PUT',
    `${BASE}/api/sessions/abc-123/webhooks/w1`,
    { secret: '' },
  ],
  [
    'webhook/update prefers Clear Secret over a supplied secret',
    {
      resource: 'webhook',
      operation: 'update',
      sessionId: 'abc-123',
      webhookId: 'w1',
      updateFields: { clearSecret: true, secret: 'sixteen-char-secret' },
    },
    'PUT',
    `${BASE}/api/sessions/abc-123/webhooks/w1`,
    { secret: '' },
  ],
  [
    'webhook/update sends a non-empty secret',
    {
      resource: 'webhook',
      operation: 'update',
      sessionId: 'abc-123',
      webhookId: 'w1',
      updateFields: { secret: 'sixteen-char-secret' },
    },
    'PUT',
    `${BASE}/api/sessions/abc-123/webhooks/w1`,
    { secret: 'sixteen-char-secret' },
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

// ---- group ----
// The JID's `@` is percent-encoded into the path, so assert against the encoded form.
const GID = '120363021234567890@g.us';
const GID_URL = `${BASE}/api/sessions/abc-123/groups/120363021234567890%40g.us`;
const P = ['628123456789@c.us'];

mappingCases.push(
  [
    'group/list without options',
    { resource: 'group', operation: 'list', sessionId: 'abc-123' },
    'GET',
    `${BASE}/api/sessions/abc-123/groups`,
    undefined,
  ],
  [
    'group/create',
    {
      resource: 'group',
      operation: 'create',
      sessionId: 'abc-123',
      groupName: '  Project Team ',
      groupParticipants: P,
    },
    'POST',
    `${BASE}/api/sessions/abc-123/groups`,
    { name: 'Project Team', participants: P },
  ],
  [
    'group/join with a bare invite code',
    {
      resource: 'group',
      operation: 'join',
      sessionId: 'abc-123',
      groupInviteCode: ' XyZ987654321 ',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/groups/join`,
    { inviteCode: 'XyZ987654321' },
  ],
  [
    'group/join reduces a full invite link to the code',
    {
      resource: 'group',
      operation: 'join',
      sessionId: 'abc-123',
      groupInviteCode: 'https://chat.whatsapp.com/XyZ987654321',
    },
    'POST',
    `${BASE}/api/sessions/abc-123/groups/join`,
    { inviteCode: 'XyZ987654321' },
  ],
  [
    'group/get',
    { resource: 'group', operation: 'get', sessionId: 'abc-123', groupId: GID },
    'GET',
    GID_URL,
    undefined,
  ],
  [
    'group/getInviteCode',
    { resource: 'group', operation: 'getInviteCode', sessionId: 'abc-123', groupId: GID },
    'GET',
    `${GID_URL}/invite-code`,
    undefined,
  ],
  [
    'group/getSettings',
    { resource: 'group', operation: 'getSettings', sessionId: 'abc-123', groupId: GID },
    'GET',
    `${GID_URL}/settings`,
    undefined,
  ],
  [
    'group/leave',
    { resource: 'group', operation: 'leave', sessionId: 'abc-123', groupId: GID },
    'POST',
    `${GID_URL}/leave`,
    undefined,
  ],
  [
    'group/revokeInviteCode',
    { resource: 'group', operation: 'revokeInviteCode', sessionId: 'abc-123', groupId: GID },
    'POST',
    `${GID_URL}/invite-code/revoke`,
    undefined,
  ],
  [
    'group/addParticipants',
    {
      resource: 'group',
      operation: 'addParticipants',
      sessionId: 'abc-123',
      groupId: GID,
      groupParticipants: P,
    },
    'POST',
    `${GID_URL}/participants`,
    { participants: P },
  ],
  [
    'group/removeParticipants sends the list in the DELETE body',
    {
      resource: 'group',
      operation: 'removeParticipants',
      sessionId: 'abc-123',
      groupId: GID,
      groupParticipants: P,
    },
    'DELETE',
    `${GID_URL}/participants`,
    { participants: P },
  ],
  [
    'group/promoteParticipants',
    {
      resource: 'group',
      operation: 'promoteParticipants',
      sessionId: 'abc-123',
      groupId: GID,
      groupParticipants: P,
    },
    'POST',
    `${GID_URL}/participants/promote`,
    { participants: P },
  ],
  [
    'group/demoteParticipants',
    {
      resource: 'group',
      operation: 'demoteParticipants',
      sessionId: 'abc-123',
      groupId: GID,
      groupParticipants: P,
    },
    'POST',
    `${GID_URL}/participants/demote`,
    { participants: P },
  ],
  [
    'group/updateSubject',
    {
      resource: 'group',
      operation: 'updateSubject',
      sessionId: 'abc-123',
      groupId: GID,
      groupSubject: '  New Team Name ',
    },
    'PUT',
    `${GID_URL}/subject`,
    { subject: 'New Team Name' },
  ],
  [
    'group/updateDescription',
    {
      resource: 'group',
      operation: 'updateDescription',
      sessionId: 'abc-123',
      groupId: GID,
      groupDescription: 'Internal coordination group.',
    },
    'PUT',
    `${GID_URL}/description`,
    { description: 'Internal coordination group.' },
  ],
  [
    'group/updateDescription sends an empty string to clear the description',
    {
      resource: 'group',
      operation: 'updateDescription',
      sessionId: 'abc-123',
      groupId: GID,
      groupDescription: '',
    },
    'PUT',
    `${GID_URL}/description`,
    { description: '' },
  ],
  [
    'group/updateSettings sends only the settings that were set',
    {
      resource: 'group',
      operation: 'updateSettings',
      sessionId: 'abc-123',
      groupId: GID,
      groupSettings: { announce: true, ephemeralSeconds: 86400 },
    },
    'PUT',
    `${GID_URL}/settings`,
    { announce: true, ephemeralSeconds: 86400 },
  ],
  [
    'group/updateSettings keeps a false toggle instead of dropping it',
    {
      resource: 'group',
      operation: 'updateSettings',
      sessionId: 'abc-123',
      groupId: GID,
      groupSettings: { announce: false },
    },
    'PUT',
    `${GID_URL}/settings`,
    { announce: false },
  ],
);

// ---- chat ----
const S = { sessionId: 'abc-123' };
const CHAT = '628123456789@c.us';
const SESS = `${BASE}/api/sessions/abc-123`;
const GROUP = '120363021234567890@g.us';
const CHANNEL = '120363021234567890@newsletter';

mappingCases.push(
  // --- catalog ---
  [
    'catalog/get',
    { resource: 'catalog', operation: 'get', ...S },
    'GET',
    `${SESS}/catalog`,
    undefined,
  ],
  [
    'catalog/listProducts',
    { resource: 'catalog', operation: 'listProducts', ...S },
    'GET',
    `${SESS}/catalog/products`,
    undefined,
  ],
  [
    'catalog/getProduct',
    { resource: 'catalog', operation: 'getProduct', ...S, productId: 'p1' },
    'GET',
    `${SESS}/catalog/products/p1`,
    undefined,
  ],
  // --- automation rules ---
  [
    'automationRule/list',
    { resource: 'automationRule', operation: 'list', ...S },
    'GET',
    `${SESS}/automation-rules`,
    undefined,
  ],
  [
    'automationRule/create',
    {
      resource: 'automationRule',
      operation: 'create',
      ...S,
      ruleName: 'Greet',
      ruleReplyText: 'Thanks',
      ruleConditions: '{"conditions":[{"field":"isGroup","operator":"is","value":false}]}',
      ruleFields: { cooldownSeconds: 0 },
    },
    'POST',
    `${SESS}/automation-rules`,
    {
      name: 'Greet',
      replyText: 'Thanks',
      conditions: { conditions: [{ field: 'isGroup', operator: 'is', value: false }] },
      cooldownSeconds: 0,
    },
  ],
  [
    'automationRule/create leaves the server defaults alone when nothing is set',
    {
      resource: 'automationRule',
      operation: 'create',
      ...S,
      ruleName: 'Greet',
      ruleReplyText: 'Thanks',
    },
    'POST',
    `${SESS}/automation-rules`,
    { name: 'Greet', replyText: 'Thanks' },
  ],
  [
    'automationRule/get',
    { resource: 'automationRule', operation: 'get', ...S, ruleId: 'r1' },
    'GET',
    `${SESS}/automation-rules/r1`,
    undefined,
  ],
  [
    'automationRule/update sends only what was set',
    {
      resource: 'automationRule',
      operation: 'update',
      ...S,
      ruleId: 'r1',
      ruleUpdateFields: { enabled: false },
    },
    'PUT',
    `${SESS}/automation-rules/r1`,
    { enabled: false },
  ],
  [
    'automationRule/delete',
    { resource: 'automationRule', operation: 'delete', ...S, ruleId: 'r1' },
    'DELETE',
    `${SESS}/automation-rules/r1`,
    undefined,
  ],
  // --- system: the one operation the mapping suite never covered ---
  [
    'system/getStatsMessages defaults to the 24 hour window',
    { resource: 'system', operation: 'getStatsMessages' },
    'GET',
    `${BASE}/api/stats/messages`,
    undefined,
  ],
  [
    'webhook/update clears headers with an empty object, which the NOT NULL column takes',
    // `null` would be written straight into the column and fail its constraint.
    {
      resource: 'webhook',
      operation: 'update',
      ...S,
      webhookId: 'w1',
      updateFields: { headers: 'null' },
    },
    'PUT',
    `${SESS}/webhooks/w1`,
    { headers: {} },
  ],
  // --- webhook create additional fields ---
  [
    'webhook/create registers filters, headers and a retry count',
    {
      resource: 'webhook',
      operation: 'create',
      ...S,
      webhookUrl: 'https://n8n.example/hook',
      events: ['message.received'],
      webhookCreateFields: {
        filters: '{"conditions":[{"field":"fromMe","operator":"is","value":false}]}',
        headers: '{"X-Team":"support"}',
        retryCount: 5,
      },
    },
    'POST',
    `${SESS}/webhooks`,
    {
      url: 'https://n8n.example/hook',
      events: ['message.received'],
      retryCount: 5,
      headers: { 'X-Team': 'support' },
      filters: { conditions: [{ field: 'fromMe', operator: 'is', value: false }] },
    },
  ],
  [
    'webhook/create sends nothing extra when no additional fields are set',
    {
      resource: 'webhook',
      operation: 'create',
      ...S,
      webhookUrl: 'https://n8n.example/hook',
      events: ['message.received'],
    },
    'POST',
    `${SESS}/webhooks`,
    { url: 'https://n8n.example/hook', events: ['message.received'] },
  ],
  // --- media conversion ---
  [
    'media/checkConversion',
    { resource: 'media', operation: 'checkConversion', ...S },
    'GET',
    `${SESS}/media/convert`,
    undefined,
  ],
  [
    'media/convertVoice sends no mimetype, which the DTO would refuse',
    {
      resource: 'media',
      operation: 'convertVoice',
      ...S,
      mediaConvertSource: 'url',
      mediaConvertUrl: 'https://example.com/a.mp3',
    },
    'POST',
    `${SESS}/media/convert/voice`,
    { url: 'https://example.com/a.mp3' },
  ],
  [
    'media/convertVideo from base64',
    {
      resource: 'media',
      operation: 'convertVideo',
      ...S,
      mediaConvertSource: 'base64',
      mediaConvertBase64: 'AAAA',
    },
    'POST',
    `${SESS}/media/convert/video`,
    { base64: 'AAAA' },
  ],
  // --- status, profile and call additions ---
  [
    'status/sendVoice nests its media under audio',
    {
      resource: 'status',
      operation: 'sendVoice',
      ...S,
      statusVoiceSource: 'url',
      statusVoiceUrl: 'https://example.com/a.ogg',
    },
    'POST',
    `${SESS}/status/send-voice`,
    { audio: { url: 'https://example.com/a.ogg' } },
  ],
  [
    'profile/deletePicture',
    { resource: 'profile', operation: 'deletePicture', ...S },
    'DELETE',
    `${SESS}/profile/picture`,
    undefined,
  ],
  [
    'call/reject still targets the call it names',
    { resource: 'call', operation: 'reject', ...S, callId: 'c1' },
    'POST',
    `${SESS}/calls/c1/reject`,
    undefined,
  ],
  [
    'call/createLink',
    {
      resource: 'call',
      operation: 'createLink',
      ...S,
      callLinkType: 'audio',
      callLinkStartTime: '2027-01-01T00:00:00Z',
    },
    'POST',
    `${SESS}/calls/link`,
    { type: 'audio', startTime: Date.parse('2027-01-01T00:00:00Z') },
  ],
  // --- group: new operations ---
  [
    'group/getJoinInfo',
    { resource: 'group', operation: 'getJoinInfo', ...S, groupInviteCode: 'XyZ987' },
    'GET',
    `${SESS}/groups/join-info`,
    undefined,
  ],
  [
    'group/getMembershipRequests',
    { resource: 'group', operation: 'getMembershipRequests', ...S, groupId: GROUP },
    'GET',
    `${SESS}/groups/${encodeURIComponent(GROUP)}/membership-requests`,
    undefined,
  ],
  [
    'group/approveMembershipRequests names the requesters',
    {
      resource: 'group',
      operation: 'approveMembershipRequests',
      ...S,
      groupId: GROUP,
      groupRequestParticipants: '628123456789@c.us',
    },
    'POST',
    `${SESS}/groups/${encodeURIComponent(GROUP)}/membership-requests/approve`,
    { participants: ['628123456789@c.us'] },
  ],
  [
    'group/rejectMembershipRequests with no list means every pending request',
    { resource: 'group', operation: 'rejectMembershipRequests', ...S, groupId: GROUP },
    'POST',
    `${SESS}/groups/${encodeURIComponent(GROUP)}/membership-requests/reject`,
    undefined,
  ],
  [
    'group/getPicture',
    { resource: 'group', operation: 'getPicture', ...S, groupId: GROUP },
    'GET',
    `${SESS}/groups/${encodeURIComponent(GROUP)}/picture`,
    undefined,
  ],
  [
    'group/setPicture',
    {
      resource: 'group',
      operation: 'setPicture',
      ...S,
      groupId: GROUP,
      groupPictureSource: 'url',
      groupPictureUrl: 'https://example.com/g.png',
    },
    'PUT',
    `${SESS}/groups/${encodeURIComponent(GROUP)}/picture`,
    { url: 'https://example.com/g.png' },
  ],
  [
    'group/deletePicture',
    { resource: 'group', operation: 'deletePicture', ...S, groupId: GROUP },
    'DELETE',
    `${SESS}/groups/${encodeURIComponent(GROUP)}/picture`,
    undefined,
  ],
  [
    'group/updateSettings carries memberAddMode',
    {
      resource: 'group',
      operation: 'updateSettings',
      ...S,
      groupId: GROUP,
      groupSettings: { memberAddMode: 'admins' },
    },
    'PUT',
    `${SESS}/groups/${encodeURIComponent(GROUP)}/settings`,
    { memberAddMode: 'admins' },
  ],
  // --- channel: new operations ---
  [
    'channel/create',
    { resource: 'channel', operation: 'create', ...S, channelName: 'Updates' },
    'POST',
    `${SESS}/channels`,
    { name: 'Updates' },
  ],
  [
    'channel/delete is a POST on its own path, not the unsubscribe DELETE',
    { resource: 'channel', operation: 'delete', ...S, channelId: CHANNEL },
    'POST',
    `${SESS}/channels/${encodeURIComponent(CHANNEL)}/delete`,
    undefined,
  ],
  [
    'channel/unsubscribe stays a DELETE on the channel itself',
    { resource: 'channel', operation: 'unsubscribe', ...S, channelId: CHANNEL },
    'DELETE',
    `${SESS}/channels/${encodeURIComponent(CHANNEL)}`,
    undefined,
  ],
  [
    'channel/mute',
    { resource: 'channel', operation: 'mute', ...S, channelId: CHANNEL, channelMute: false },
    'POST',
    `${SESS}/channels/${encodeURIComponent(CHANNEL)}/mute`,
    { mute: false },
  ],
  [
    'channel/demoteAdmin',
    {
      resource: 'channel',
      operation: 'demoteAdmin',
      ...S,
      channelId: CHANNEL,
      channelUserId: '628123456789@c.us',
    },
    'POST',
    `${SESS}/channels/${encodeURIComponent(CHANNEL)}/admins/demote`,
    { userId: '628123456789@c.us' },
  ],
  [
    'channel/transferOwnership',
    {
      resource: 'channel',
      operation: 'transferOwnership',
      ...S,
      channelId: CHANNEL,
      channelNewOwnerId: '628123456789@c.us',
    },
    'POST',
    `${SESS}/channels/${encodeURIComponent(CHANNEL)}/owner/transfer`,
    { newOwnerId: '628123456789@c.us' },
  ],
  // --- chat: new operations ---
  [
    'chat/archive',
    { resource: 'chat', operation: 'archive', ...S, chatId: CHAT, archive: false },
    'POST',
    `${SESS}/chats/archive`,
    { chatId: CHAT, archive: false },
  ],
  [
    'chat/pin',
    { resource: 'chat', operation: 'pin', ...S, chatId: CHAT },
    'POST',
    `${SESS}/chats/pin`,
    { chatId: CHAT, pin: true },
  ],
  [
    'chat/mute converts the picker value to epoch milliseconds',
    { resource: 'chat', operation: 'mute', ...S, chatId: CHAT, muteUntil: '2027-01-01T00:00:00Z' },
    'POST',
    `${SESS}/chats/mute`,
    { chatId: CHAT, muteUntil: Date.parse('2027-01-01T00:00:00Z') },
  ],
  [
    'chat/mute sends an explicit null to unmute, never dropping the key',
    { resource: 'chat', operation: 'mute', ...S, chatId: CHAT, muteUntil: '' },
    'POST',
    `${SESS}/chats/mute`,
    { chatId: CHAT, muteUntil: null },
  ],
  [
    'chat/clearMessages names its chat in the path, unlike its siblings',
    { resource: 'chat', operation: 'clearMessages', ...S, chatId: CHAT },
    'DELETE',
    `${SESS}/chats/${encodeURIComponent(CHAT)}/messages`,
    undefined,
  ],
  // --- contact: new operations ---
  [
    'contact/listBlocked',
    { resource: 'contact', operation: 'listBlocked', ...S },
    'GET',
    `${SESS}/contacts/blocked`,
    undefined,
  ],
  [
    'contact/save',
    {
      resource: 'contact',
      operation: 'save',
      ...S,
      contactId: CHAT,
      contactFirstName: 'Ada',
      contactLastName: 'Lovelace',
    },
    'PUT',
    `${SESS}/contacts/${encodeURIComponent(CHAT)}`,
    { firstName: 'Ada', lastName: 'Lovelace' },
  ],
  [
    'contact/save omits a blank last name rather than sending an empty one',
    { resource: 'contact', operation: 'save', ...S, contactId: CHAT, contactFirstName: 'Ada' },
    'PUT',
    `${SESS}/contacts/${encodeURIComponent(CHAT)}`,
    { firstName: 'Ada' },
  ],
  [
    'contact/delete',
    { resource: 'contact', operation: 'delete', ...S, contactId: CHAT },
    'DELETE',
    `${SESS}/contacts/${encodeURIComponent(CHAT)}`,
    undefined,
  ],
  // --- label: new operations ---
  [
    'label/getChats',
    { resource: 'label', operation: 'getChats', ...S, labelId: 'l1' },
    'GET',
    `${SESS}/labels/l1/chats`,
    undefined,
  ],
  [
    'label/upsert',
    {
      resource: 'label',
      operation: 'upsert',
      ...S,
      newLabelId: 'l9',
      labelFields: { labelName: 'VIP', labelColor: 3 },
    },
    'PUT',
    `${SESS}/labels/l9`,
    { name: 'VIP', color: 3 },
  ],
  [
    'label/upsert keeps colour zero, which is a real colour',
    {
      resource: 'label',
      operation: 'upsert',
      ...S,
      newLabelId: 'l9',
      labelFields: { labelColor: 0 },
    },
    'PUT',
    `${SESS}/labels/l9`,
    { color: 0 },
  ],
  [
    'label/delete',
    { resource: 'label', operation: 'delete', ...S, newLabelId: 'l9' },
    'DELETE',
    `${SESS}/labels/l9`,
    undefined,
  ],
  // --- message: new operations ---
  [
    'message/pin',
    { resource: 'message', operation: 'pin', ...S, chatId: CHAT, messageId: 'm1' },
    'POST',
    `${SESS}/messages/pin`,
    { chatId: CHAT, messageId: 'm1', durationSeconds: 86400 },
  ],
  [
    'message/pin honours a longer window',
    {
      resource: 'message',
      operation: 'pin',
      ...S,
      chatId: CHAT,
      messageId: 'm1',
      pinDurationSeconds: 604800,
    },
    'POST',
    `${SESS}/messages/pin`,
    { chatId: CHAT, messageId: 'm1', durationSeconds: 604800 },
  ],
  [
    'message/unpin never carries a duration',
    { resource: 'message', operation: 'unpin', ...S, chatId: CHAT, messageId: 'm1' },
    'POST',
    `${SESS}/messages/unpin`,
    { chatId: CHAT, messageId: 'm1' },
  ],
  [
    'message/star',
    { resource: 'message', operation: 'star', ...S, chatId: CHAT, messageId: 'm1', star: false },
    'POST',
    `${SESS}/messages/star`,
    { chatId: CHAT, messageId: 'm1', star: false },
  ],
  [
    'message/votePoll uses the pollMessageId wire name',
    {
      resource: 'message',
      operation: 'votePoll',
      ...S,
      chatId: CHAT,
      messageId: 'm1',
      pollVoteOptions: 'Pizza, Sushi',
    },
    'POST',
    `${SESS}/messages/vote-poll`,
    { chatId: CHAT, pollMessageId: 'm1', options: ['Pizza', 'Sushi'] },
  ],
  [
    'message/votePoll sends an empty selection, which clears the vote',
    { resource: 'message', operation: 'votePoll', ...S, chatId: CHAT, messageId: 'm1' },
    'POST',
    `${SESS}/messages/vote-poll`,
    { chatId: CHAT, pollMessageId: 'm1', options: [] },
  ],
  [
    'message/sendProduct',
    {
      resource: 'message',
      operation: 'sendProduct',
      ...S,
      chatId: CHAT,
      productId: 'p1',
      productBody: 'Have a look',
    },
    'POST',
    `${SESS}/messages/send-product`,
    { chatId: CHAT, productId: 'p1', body: 'Have a look' },
  ],
  // --- message: new shared fields ---
  [
    'message/sendImage can quote a message',
    {
      resource: 'message',
      operation: 'sendImage',
      ...S,
      chatId: CHAT,
      imageSource: 'url',
      imageUrl: 'https://example.com/i.png',
      sendQuotedMessageId: 'm1',
    },
    'POST',
    `${SESS}/messages/send-image`,
    { chatId: CHAT, url: 'https://example.com/i.png', quotedMessageId: 'm1' },
  ],
  [
    'message/sendTemplate does not accept a quote, so it never rides along',
    {
      resource: 'message',
      operation: 'sendTemplate',
      ...S,
      chatId: CHAT,
      sendTemplateName: 'welcome',
      sendQuotedMessageId: 'm1',
    },
    'POST',
    `${SESS}/messages/send-template`,
    { chatId: CHAT, templateName: 'welcome' },
  ],
  [
    'message/reply can now tag participants',
    {
      resource: 'message',
      operation: 'reply',
      ...S,
      chatId: CHAT,
      quotedMessageId: 'm1',
      message: 'hi @628123456789',
      mentions: '628123456789@c.us',
    },
    'POST',
    `${SESS}/messages/reply`,
    {
      chatId: CHAT,
      quotedMessageId: 'm1',
      text: 'hi @628123456789',
      mentions: ['628123456789@c.us'],
    },
  ],
  [
    'message/sendText suppresses a link preview on request',
    { resource: 'message', operation: 'sendText', ...S, chatId: CHAT, message: 'x', linkPreview: 'no' },
    'POST',
    `${SESS}/messages/send-text`,
    { chatId: CHAT, text: 'x', linkPreview: false },
  ],
  [
    'message/sendText leaves the preview to the engine by default',
    { resource: 'message', operation: 'sendText', ...S, chatId: CHAT, message: 'x' },
    'POST',
    `${SESS}/messages/send-text`,
    { chatId: CHAT, text: 'x' },
  ],
  [
    'message/sendText attaches a complete custom preview',
    {
      resource: 'message',
      operation: 'sendText',
      ...S,
      chatId: CHAT,
      message: 'see https://example.com',
      customLinkPreview: { previewUrl: 'https://example.com', previewTitle: 'Example' },
    },
    'POST',
    `${SESS}/messages/send-text`,
    {
      chatId: CHAT,
      text: 'see https://example.com',
      customLinkPreview: { url: 'https://example.com', title: 'Example' },
    },
  ],
  [
    'message/sendText drops a half-filled custom preview rather than sending an object the server refuses',
    {
      resource: 'message',
      operation: 'sendText',
      ...S,
      chatId: CHAT,
      message: 'x',
      customLinkPreview: { previewUrl: 'https://example.com' },
    },
    'POST',
    `${SESS}/messages/send-text`,
    { chatId: CHAT, text: 'x' },
  ],
  [
    'message/sendLocation carries an address alongside the label',
    {
      resource: 'message',
      operation: 'sendLocation',
      ...S,
      chatId: CHAT,
      latitude: 1,
      longitude: 2,
      locationName: 'Office',
      locationAddress: 'Jl. Sudirman No. 1',
    },
    'POST',
    `${SESS}/messages/send-location`,
    {
      chatId: CHAT,
      latitude: 1,
      longitude: 2,
      description: 'Office',
      address: 'Jl. Sudirman No. 1',
    },
  ],
  // --- presence ---
  [
    'presence/subscribe',
    { resource: 'presence', operation: 'subscribe', ...S, chatId: CHAT },
    'POST',
    `${SESS}/presence/subscribe`,
    { chatId: CHAT },
  ],
  [
    'presence/get',
    { resource: 'presence', operation: 'get', ...S, chatId: CHAT },
    'GET',
    `${SESS}/presence/${encodeURIComponent(CHAT)}`,
    undefined,
  ],
  [
    'presence/setOwn appears offline',
    { resource: 'presence', operation: 'setOwn', ...S, presenceAvailable: false },
    'PUT',
    `${SESS}/presence`,
    { available: false },
  ],
  // --- session additions ---
  [
    'session/logout',
    { resource: 'session', operation: 'logout', ...S },
    'POST',
    `${SESS}/logout`,
    undefined,
  ],
  [
    'session/getConfig',
    { resource: 'session', operation: 'getConfig', ...S },
    'GET',
    `${SESS}/config`,
    undefined,
  ],
  [
    'session/updateConfig sends only the fields that were set',
    {
      resource: 'session',
      operation: 'updateConfig',
      ...S,
      sessionConfigFields: { autoRejectCalls: false, reconnectBaseDelay: 10000 },
    },
    'PATCH',
    `${SESS}/config`,
    { autoRejectCalls: false, reconnectBaseDelay: 10000 },
  ],
  [
    'session/updateConfig translates the unlimited sentinel to null',
    {
      resource: 'session',
      operation: 'updateConfig',
      ...S,
      sessionConfigFields: { maxReconnectAttempts: -1 },
    },
    'PATCH',
    `${SESS}/config`,
    { maxReconnectAttempts: null },
  ],
  [
    'session/updateConfig keeps a zero cap, which disables reconnection',
    {
      resource: 'session',
      operation: 'updateConfig',
      ...S,
      sessionConfigFields: { maxReconnectAttempts: 0 },
    },
    'PATCH',
    `${SESS}/config`,
    { maxReconnectAttempts: 0 },
  ],
  [
    'session/getProxy',
    { resource: 'session', operation: 'getProxy', ...S },
    'GET',
    `${SESS}/proxy`,
    undefined,
  ],
  [
    'session/updateProxy sets a proxy',
    { resource: 'session', operation: 'updateProxy', ...S, proxyUrl: 'socks5://127.0.0.1:1080' },
    'PATCH',
    `${SESS}/proxy`,
    { proxyUrl: 'socks5://127.0.0.1:1080' },
  ],
  [
    // Only an explicit null clears it server-side; an omitted key is a no-op read.
    'session/updateProxy clears a proxy with an explicit null',
    {
      resource: 'session',
      operation: 'updateProxy',
      ...S,
      proxyClear: true,
      proxyUrl: 'socks5://127.0.0.1:1080',
    },
    'PATCH',
    `${SESS}/proxy`,
    { proxyUrl: null },
  ],
  [
    'session/create forwards a proxy URL',
    {
      resource: 'session',
      operation: 'create',
      sessionName: 'sales',
      proxyUrl: 'socks5://127.0.0.1:1080',
    },
    'POST',
    `${BASE}/api/sessions`,
    { name: 'sales', proxyUrl: 'socks5://127.0.0.1:1080' },
  ],
  ['chat/list', { resource: 'chat', operation: 'list', ...S }, 'GET', `${SESS}/chats`, undefined],
  [
    'chat/markRead',
    { resource: 'chat', operation: 'markRead', ...S, chatId: CHAT },
    'POST',
    `${SESS}/chats/read`,
    { chatId: CHAT },
  ],
  [
    'chat/markRead with explicit message ids',
    {
      resource: 'chat',
      operation: 'markRead',
      ...S,
      chatId: CHAT,
      readMessageIds: 'm1, m2',
    },
    'POST',
    `${SESS}/chats/read`,
    { chatId: CHAT, messageIds: ['m1', 'm2'] },
  ],
  [
    'chat/markUnread',
    { resource: 'chat', operation: 'markUnread', ...S, chatId: CHAT },
    'POST',
    `${SESS}/chats/unread`,
    { chatId: CHAT },
  ],
  [
    'chat/delete posts to /chats/delete rather than issuing a DELETE',
    { resource: 'chat', operation: 'delete', ...S, chatId: CHAT },
    'POST',
    `${SESS}/chats/delete`,
    { chatId: CHAT },
  ],
  [
    'chat/setState',
    { resource: 'chat', operation: 'setState', ...S, chatId: CHAT, chatState: 'recording' },
    'POST',
    `${SESS}/chats/typing`,
    { chatId: CHAT, state: 'recording' },
  ],
);

// ---- session additions ----
mappingCases.push([
  'session/getStatsOverview',
  { resource: 'session', operation: 'getStatsOverview' },
  'GET',
  `${BASE}/api/sessions/stats/overview`,
  undefined,
]);

// ---- message additions ----
mappingCases.push(
  [
    'message/sendPoll',
    {
      resource: 'message',
      operation: 'sendPoll',
      ...S,
      chatId: CHAT,
      pollName: '  Lunch? ',
      pollOptions: ['Pizza', 'Sushi'],
    },
    'POST',
    `${SESS}/messages/send-poll`,
    { chatId: CHAT, name: 'Lunch?', options: ['Pizza', 'Sushi'] },
  ],
  [
    'message/sendPoll with multiple answers enabled',
    {
      resource: 'message',
      operation: 'sendPoll',
      ...S,
      chatId: CHAT,
      pollName: 'Lunch?',
      pollOptions: ['Pizza', 'Sushi'],
      allowMultipleAnswers: true,
    },
    'POST',
    `${SESS}/messages/send-poll`,
    { chatId: CHAT, name: 'Lunch?', options: ['Pizza', 'Sushi'], allowMultipleAnswers: true },
  ],
  [
    'message/sendTemplate by id',
    {
      resource: 'message',
      operation: 'sendTemplate',
      ...S,
      chatId: CHAT,
      sendTemplateId: 't1',
      templateVars: '{"name":"Alice"}',
    },
    'POST',
    `${SESS}/messages/send-template`,
    { chatId: CHAT, templateId: 't1', vars: { name: 'Alice' } },
  ],
  [
    'message/sendTemplate falls back to the name when no id is given',
    {
      resource: 'message',
      operation: 'sendTemplate',
      ...S,
      chatId: CHAT,
      sendTemplateName: 'welcome',
    },
    'POST',
    `${SESS}/messages/send-template`,
    { chatId: CHAT, templateName: 'welcome' },
  ],
  [
    'message/edit',
    {
      resource: 'message',
      operation: 'edit',
      ...S,
      chatId: CHAT,
      messageId: 'm1',
      message: 'corrected text',
    },
    'POST',
    `${SESS}/messages/edit`,
    { chatId: CHAT, messageId: 'm1', body: 'corrected text' },
  ],
  [
    'message/edit re-applies mentions',
    {
      resource: 'message',
      operation: 'edit',
      ...S,
      chatId: CHAT,
      messageId: 'm1',
      message: 'corrected @628123456789',
      mentions: '628123456789@c.us',
    },
    'POST',
    `${SESS}/messages/edit`,
    {
      chatId: CHAT,
      messageId: 'm1',
      body: 'corrected @628123456789',
      mentions: ['628123456789@c.us'],
    },
  ],
  [
    'message/forward uses its own from/to chats',
    {
      resource: 'message',
      operation: 'forward',
      ...S,
      fromChatId: CHAT,
      toChatId: '628987654321@c.us',
      messageId: 'm1',
    },
    'POST',
    `${SESS}/messages/forward`,
    { fromChatId: CHAT, toChatId: '628987654321@c.us', messageId: 'm1' },
  ],
  [
    'message/list',
    { resource: 'message', operation: 'list', ...S },
    'GET',
    `${SESS}/messages`,
    undefined,
  ],
  [
    'message/getHistory encodes the chat id into the path',
    { resource: 'message', operation: 'getHistory', ...S, chatId: CHAT },
    'GET',
    `${SESS}/messages/628123456789%40c.us/history`,
    undefined,
  ],
  [
    'message/getReactions',
    { resource: 'message', operation: 'getReactions', ...S, chatId: CHAT, messageId: 'm1' },
    'GET',
    `${SESS}/messages/628123456789%40c.us/m1/reactions`,
    undefined,
  ],
);

// ---- contact additions ----
mappingCases.push(
  ['contact/list', { resource: 'contact', operation: 'list', ...S }, 'GET', `${SESS}/contacts`, undefined],
  [
    'contact/getProfilePictures',
    { resource: 'contact', operation: 'getProfilePictures', ...S, contactIds: [CHAT, '2@c.us'] },
    'GET',
    `${SESS}/contacts/profile-pictures`,
    undefined,
  ],
);

// ---- profile ----
mappingCases.push(
  [
    'profile/setName',
    { resource: 'profile', operation: 'setName', ...S, profileName: '  Ops Bot ' },
    'PUT',
    `${SESS}/profile/name`,
    { name: 'Ops Bot' },
  ],
  [
    'profile/setStatus',
    { resource: 'profile', operation: 'setStatus', ...S, profileStatus: 'Away' },
    'PUT',
    `${SESS}/profile/status`,
    { status: 'Away' },
  ],
  [
    'profile/setStatus sends an empty string to clear the about text',
    { resource: 'profile', operation: 'setStatus', ...S, profileStatus: '' },
    'PUT',
    `${SESS}/profile/status`,
    { status: '' },
  ],
  [
    'profile/setPicture from a URL',
    {
      resource: 'profile',
      operation: 'setPicture',
      ...S,
      profilePictureSource: 'url',
      profilePictureUrl: 'https://example.com/a.jpg',
    },
    'PUT',
    `${SESS}/profile/picture`,
    { url: 'https://example.com/a.jpg' },
  ],
  [
    'profile/setPicture from binary data',
    {
      resource: 'profile',
      operation: 'setPicture',
      ...S,
      profilePictureSource: 'binary',
      profilePictureBinaryProperty: 'data',
    },
    'PUT',
    `${SESS}/profile/picture`,
    { base64: IMG_B64, mimetype: 'image/png' },
  ],
);

// ---- label ----
mappingCases.push(
  ['label/list', { resource: 'label', operation: 'list', ...S }, 'GET', `${SESS}/labels`, undefined],
  [
    'label/get',
    { resource: 'label', operation: 'get', ...S, labelId: 'l1' },
    'GET',
    `${SESS}/labels/l1`,
    undefined,
  ],
  [
    'label/getForChat',
    { resource: 'label', operation: 'getForChat', ...S, chatId: CHAT },
    'GET',
    `${SESS}/labels/chat/628123456789%40c.us`,
    undefined,
  ],
  [
    'label/addToChat',
    { resource: 'label', operation: 'addToChat', ...S, chatId: CHAT, labelId: 'l1' },
    'POST',
    `${SESS}/labels/chat/628123456789%40c.us`,
    { labelId: 'l1' },
  ],
  [
    'label/removeFromChat',
    { resource: 'label', operation: 'removeFromChat', ...S, chatId: CHAT, labelId: 'l1' },
    'DELETE',
    `${SESS}/labels/chat/628123456789%40c.us/l1`,
    undefined,
  ],
);

// ---- status ----
mappingCases.push(
  ['status/list', { resource: 'status', operation: 'list', ...S }, 'GET', `${SESS}/status`, undefined],
  [
    'status/getByContact',
    { resource: 'status', operation: 'getByContact', ...S, statusContactId: CHAT },
    'GET',
    `${SESS}/status/628123456789%40c.us`,
    undefined,
  ],
  [
    'status/getMedia',
    { resource: 'status', operation: 'getMedia', ...S, statusId: 's1' },
    'GET',
    `${SESS}/status/s1/media`,
    undefined,
    // This route answers with bytes, so the default `{}` stub would not survive
    // the binary branch.
    { response: Buffer.from('MEDIABYTES') },
  ],
  [
    'status/delete',
    { resource: 'status', operation: 'delete', ...S, statusId: 's1' },
    'DELETE',
    `${SESS}/status/s1`,
    undefined,
  ],
  [
    'status/sendText',
    { resource: 'status', operation: 'sendText', ...S, statusText: 'Hello' },
    'POST',
    `${SESS}/status/send-text`,
    { text: 'Hello' },
  ],
  [
    'status/sendText with font 0 keeps the index instead of treating it as unset',
    { resource: 'status', operation: 'sendText', ...S, statusText: 'Hello', statusFont: 0 },
    'POST',
    `${SESS}/status/send-text`,
    { text: 'Hello', font: 0 },
  ],
  [
    'status/sendText drops the server-default font sentinel',
    { resource: 'status', operation: 'sendText', ...S, statusText: 'Hello', statusFont: -1 },
    'POST',
    `${SESS}/status/send-text`,
    { text: 'Hello' },
  ],
  [
    'status/sendImage nests the media under an image key',
    {
      resource: 'status',
      operation: 'sendImage',
      ...S,
      statusImageSource: 'url',
      statusImageUrl: 'https://example.com/a.jpg',
      statusRecipients: [CHAT],
    },
    'POST',
    `${SESS}/status/send-image`,
    { image: { url: 'https://example.com/a.jpg' }, recipients: [CHAT] },
  ],
  [
    'status/sendVideo nests the media under a video key',
    {
      resource: 'status',
      operation: 'sendVideo',
      ...S,
      statusVideoSource: 'url',
      statusVideoUrl: 'https://example.com/a.mp4',
      statusCaption: 'Clip',
    },
    'POST',
    `${SESS}/status/send-video`,
    { video: { url: 'https://example.com/a.mp4' }, caption: 'Clip' },
  ],
);

// ---- template ----
mappingCases.push(
  [
    'template/list',
    { resource: 'template', operation: 'list', ...S },
    'GET',
    `${SESS}/templates`,
    undefined,
  ],
  [
    'template/get',
    { resource: 'template', operation: 'get', ...S, templateId: 't1' },
    'GET',
    `${SESS}/templates/t1`,
    undefined,
  ],
  [
    'template/create',
    {
      resource: 'template',
      operation: 'create',
      ...S,
      templateName: 'welcome',
      templateBody: 'Hi {{name}}',
      templateFooter: 'Team',
    },
    'POST',
    `${SESS}/templates`,
    { name: 'welcome', body: 'Hi {{name}}', footer: 'Team' },
  ],
  [
    'template/update sends only the fields that were set',
    {
      resource: 'template',
      operation: 'update',
      ...S,
      templateId: 't1',
      templateUpdateFields: { body: 'Hello {{name}}' },
    },
    'PUT',
    `${SESS}/templates/t1`,
    { body: 'Hello {{name}}' },
  ],
  [
    'template/update forwards a blank footer, which clears it server-side',
    // Only `name` and `body` are IsNotEmpty on the server; a blank header or
    // footer is a deliberate clear and must still be sent.
    {
      resource: 'template',
      operation: 'update',
      ...S,
      templateId: 't1',
      templateUpdateFields: { footer: '' },
    },
    'PUT',
    `${SESS}/templates/t1`,
    { footer: '' },
  ],
  [
    'template/delete',
    { resource: 'template', operation: 'delete', ...S, templateId: 't1' },
    'DELETE',
    `${SESS}/templates/t1`,
    undefined,
  ],
);

// ---- channel / call ----
mappingCases.push(
  ['channel/list', { resource: 'channel', operation: 'list', ...S }, 'GET', `${SESS}/channels`, undefined],
  [
    'channel/get',
    { resource: 'channel', operation: 'get', ...S, channelId: 'c1@newsletter' },
    'GET',
    `${SESS}/channels/c1%40newsletter`,
    undefined,
  ],
  [
    'channel/unsubscribe',
    { resource: 'channel', operation: 'unsubscribe', ...S, channelId: 'c1@newsletter' },
    'DELETE',
    `${SESS}/channels/c1%40newsletter`,
    undefined,
  ],
  [
    'channel/getMessages',
    { resource: 'channel', operation: 'getMessages', ...S, channelId: 'c1@newsletter' },
    'GET',
    `${SESS}/channels/c1%40newsletter/messages`,
    undefined,
  ],
  [
    'channel/subscribe reduces a full channel link to the code',
    {
      resource: 'channel',
      operation: 'subscribe',
      ...S,
      channelInviteCode: 'https://whatsapp.com/channel/ABC123xyz',
    },
    'POST',
    `${SESS}/channels/subscribe`,
    { inviteCode: 'ABC123xyz' },
  ],
  [
    'call/reject',
    { resource: 'call', operation: 'reject', ...S, callId: 'call-1' },
    'POST',
    `${SESS}/calls/call-1/reject`,
    undefined,
  ],
);

// ---- observability ----
mappingCases.push(
  [
    'observability/check',
    { resource: 'observability', operation: 'check' },
    'GET',
    `${BASE}/api/health`,
    undefined,
  ],
  [
    'observability/checkLiveness',
    { resource: 'observability', operation: 'checkLiveness' },
    'GET',
    `${BASE}/api/health/live`,
    undefined,
  ],
  [
    'observability/checkReadiness',
    { resource: 'observability', operation: 'checkReadiness' },
    'GET',
    `${BASE}/api/health/ready`,
    undefined,
  ],
);

// ---- system ----
mappingCases.push(
  [
    'system/getSettings',
    { resource: 'system', operation: 'getSettings' },
    'GET',
    `${BASE}/api/settings`,
    undefined,
  ],
  [
    'system/getStatsOverview',
    { resource: 'system', operation: 'getStatsOverview' },
    'GET',
    `${BASE}/api/stats/overview`,
    undefined,
  ],
  [
    'system/getSessionStats',
    { resource: 'system', operation: 'getSessionStats', ...S },
    'GET',
    `${BASE}/api/stats/sessions/abc-123`,
    undefined,
  ],
);

// ---- api key ----
mappingCases.push(
  ['apiKey/list', { resource: 'apiKey', operation: 'list' }, 'GET', `${BASE}/api/auth/api-keys`, undefined],
  [
    'apiKey/validate',
    { resource: 'apiKey', operation: 'validate' },
    'POST',
    `${BASE}/api/auth/validate`,
    undefined,
  ],
  [
    'apiKey/get',
    { resource: 'apiKey', operation: 'get', keyId: 'k1' },
    'GET',
    `${BASE}/api/auth/api-keys/k1`,
    undefined,
  ],
  [
    'apiKey/create',
    {
      resource: 'apiKey',
      operation: 'create',
      keyName: 'ops',
      keyFields: { role: 'operator', allowedIps: ['10.0.0.1'] },
    },
    'POST',
    `${BASE}/api/auth/api-keys`,
    { name: 'ops', role: 'operator', allowedIps: ['10.0.0.1'] },
  ],
  [
    'apiKey/update',
    { resource: 'apiKey', operation: 'update', keyId: 'k1', keyFields: { role: 'viewer' } },
    'PUT',
    `${BASE}/api/auth/api-keys/k1`,
    { role: 'viewer' },
  ],
  [
    'apiKey/revoke',
    { resource: 'apiKey', operation: 'revoke', keyId: 'k1' },
    'POST',
    `${BASE}/api/auth/api-keys/k1/revoke`,
    undefined,
  ],
  [
    'apiKey/delete',
    { resource: 'apiKey', operation: 'delete', keyId: 'k1' },
    'DELETE',
    `${BASE}/api/auth/api-keys/k1`,
    undefined,
  ],
);

// ---- webhook additions ----
mappingCases.push(
  [
    'webhook/list',
    { resource: 'webhook', operation: 'list', ...S },
    'GET',
    `${SESS}/webhooks`,
    undefined,
  ],
  [
    'webhook/get',
    { resource: 'webhook', operation: 'get', ...S, webhookId: 'w1' },
    'GET',
    `${SESS}/webhooks/w1`,
    undefined,
  ],
  [
    'webhook/listAll is not session-scoped',
    { resource: 'webhook', operation: 'listAll' },
    'GET',
    `${BASE}/api/webhooks`,
    undefined,
  ],
  [
    'webhook/getDeliveryFailures',
    { resource: 'webhook', operation: 'getDeliveryFailures' },
    'GET',
    `${BASE}/api/webhooks/delivery-failures`,
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

// --- List responses ----------------------------------------------------------
// 19 routes answer a bare JSON array. Left whole it would land on one item's
// `json`, where `$json.<field>` is undefined and Split Out has no field to
// point at, so each row becomes its own item.

test('a list route emits one item per row, each traced back to its input item', async () => {
  const { output } = await run(
    { resource: 'chat', operation: 'list', sessionId: 'abc-123' },
    { response: [{ id: 'a@c.us' }, { id: 'b@c.us' }] },
  );
  assert.deepEqual(
    output[0].map((item) => item.json),
    [{ id: 'a@c.us' }, { id: 'b@c.us' }],
  );
  assert.deepEqual(
    output[0].map((item) => item.pairedItem),
    [{ item: 0 }, { item: 0 }],
  );
});

test('contact/listBlocked wraps its bare ids, which are not valid item json', async () => {
  const { output } = await run(
    { resource: 'contact', operation: 'listBlocked', sessionId: 'abc-123' },
    { response: ['628123456789@c.us', '628999999999@c.us'] },
  );
  assert.deepEqual(
    output[0].map((item) => item.json),
    [{ data: '628123456789@c.us' }, { data: '628999999999@c.us' }],
  );
});

test('an empty list emits no items rather than one empty array', async () => {
  const { output } = await run(
    { resource: 'chat', operation: 'list', sessionId: 'abc-123' },
    { response: [] },
  );
  assert.deepEqual(output[0], []);
});

test('an envelope is left whole, so its pagination survives', async () => {
  // catalog/listProducts answers { products, pagination }. Spreading the rows out
  // of it would drop the cursor the next page needs.
  const { output } = await run(
    { resource: 'catalog', operation: 'listProducts', sessionId: 'abc-123' },
    { response: { products: [{ id: 'p1' }], pagination: { cursor: 'c1' } } },
  );
  assert.equal(output[0].length, 1);
  assert.deepEqual(output[0][0].json, { products: [{ id: 'p1' }], pagination: { cursor: 'c1' } });
});

// --- Response parsing --------------------------------------------------------
// RequestSpec carries an optional `responseFormat` for routes that do not answer
// with JSON. 'binary' is used by status/getMedia, which streams the stored media
// bytes. 'text' has no user today — /api/metrics was the only candidate and is
// not offered, since it authenticates with a bearer token this credential does
// not carry — so the plumbing is kept for the next such route.

test('operations ask for JSON parsing', async () => {
  const { ctx } = await run({ resource: 'observability', operation: 'check' });
  assert.equal(singleCall(ctx).options.json, true);
});

test('template/update refuses an empty patch when its only field resolved to null', async () => {
  // optionalNonBlank returns undefined for null. Assigning that left the key in the
  // body, so the all-empty guard never fired and a {} PUT reported success.
  await assert.rejects(
    () =>
      run({
        resource: 'template',
        operation: 'update',
        sessionId: 'abc-123',
        templateId: 't1',
        templateUpdateFields: { name: null },
      }),
    /At least one field must be provided/,
  );
});

test('template/update ignores a null field and still sends the ones that were set', async () => {
  const { ctx } = await run({
    resource: 'template',
    operation: 'update',
    sessionId: 'abc-123',
    templateId: 't1',
    templateUpdateFields: { name: null, body: 'new body' },
  });
  assert.deepEqual(singleCall(ctx).options.body, { body: 'new body' });
});

test('a text parameter resolved to a number is coerced, not crashed on', async () => {
  // An expression can hand a handler a number. Calling .trim() on one threw a
  // TypeError that reached the user as an opaque API error naming no field.
  const { ctx } = await run({
    resource: 'contact',
    operation: 'checkExists',
    sessionId: 'abc-123',
    phoneNumber: 628123456789,
  });
  assert.match(singleCall(ctx).options.url, /contacts\/check\/628123456789$/);
});

test('a path parameter resolved to a number is coerced, not crashed on', async () => {
  const { ctx } = await run({
    resource: 'session',
    operation: 'getStatus',
    sessionId: 12345,
  });
  assert.match(singleCall(ctx).options.url, /\/api\/sessions\/12345$/);
});

test('system/getStatsMessages sends the period as a query parameter', async () => {
  const { ctx } = await run({ resource: 'system', operation: 'getStatsMessages' });
  assert.deepEqual(singleCall(ctx).options.qs, { period: '24h' });
});

test('system/getStatsMessages honours a longer window', async () => {
  const { ctx } = await run({
    resource: 'system',
    operation: 'getStatsMessages',
    statsPeriod: '30d',
  });
  assert.deepEqual(singleCall(ctx).options.qs, { period: '30d' });
});

test('call/createLink defaults a blank start time to now rather than omitting it', async () => {
  const before = Date.now();
  const { ctx } = await run({
    resource: 'call',
    operation: 'createLink',
    sessionId: 'abc-123',
    callLinkType: 'video',
    callLinkStartTime: '',
  });
  const { body } = singleCall(ctx).options;
  assert.equal(body.type, 'video');
  assert.ok(
    Number.isInteger(body.startTime) && body.startTime >= before,
    `expected an epoch-ms start time, got ${body.startTime}`,
  );
});

test('group/getJoinInfo sends the invite code as a query parameter', async () => {
  const { ctx } = await run({
    resource: 'group',
    operation: 'getJoinInfo',
    sessionId: 'abc-123',
    groupInviteCode: 'XyZ987',
  });
  assert.deepEqual(singleCall(ctx).options.qs, { code: 'XyZ987' });
});

test('group/getJoinInfo reduces a full invite link to its code', async () => {
  const { ctx } = await run({
    resource: 'group',
    operation: 'getJoinInfo',
    sessionId: 'abc-123',
    groupInviteCode: 'https://chat.whatsapp.com/XyZ987',
  });
  assert.deepEqual(singleCall(ctx).options.qs, { code: 'XyZ987' });
});

test('message/getMedia surfaces the server explanation behind a 404, not just the status', async () => {
  // A binary request asks for an arraybuffer, so the error body arrives as raw
  // bytes. Without decoding, the workflow sees a bare 404 and none of the five
  // situations that answer covers.
  const explanation = { message: 'Message has no downloadable media', statusCode: 404 };
  const err = {
    statusCode: 404,
    response: { status: 404, body: Buffer.from(JSON.stringify(explanation)) },
  };
  await assert.rejects(
    () =>
      run(
        {
          resource: 'message',
          operation: 'getMedia',
          sessionId: 'abc-123',
          chatId: '628123456789@c.us',
          messageId: 'm1',
        },
        { throwErr: err },
      ),
    (thrown) => {
      // The decode happens in place, so the original error now carries readable JSON.
      assert.deepEqual(err.response.body, explanation, 'error body should be decoded JSON');
      assert.ok(/no downloadable media/.test(JSON.stringify(thrown.message ?? thrown)) ||
        /no downloadable media/.test(JSON.stringify(err.response.body)));
      return true;
    },
  );
});

test('a non-binary failure is passed through untouched', async () => {
  const err = { statusCode: 400, response: { status: 400, body: { message: 'bad chat id' } } };
  await assert.rejects(() =>
    run({ resource: 'message', operation: 'sendText', sessionId: 'abc-123', chatId: 'x@c.us', message: 'hi' }, { throwErr: err }),
  );
  assert.deepEqual(err.response.body, { message: 'bad chat id' }, 'untouched');
});

test('message/getMedia downloads the bytes from the message media route', async () => {
  const { ctx, output } = await run(
    {
      resource: 'message',
      operation: 'getMedia',
      sessionId: 'abc-123',
      chatId: '628123456789@c.us',
      messageId: 'true_628123456789@c.us_3EB0',
    },
    { response: Buffer.from('MEDIABYTES') },
  );
  const { options } = singleCall(ctx);
  assert.equal(options.method, 'GET');
  assert.equal(
    options.url,
    `${BASE}/api/sessions/abc-123/messages/${encodeURIComponent('628123456789@c.us')}/${encodeURIComponent('true_628123456789@c.us_3EB0')}/media`,
  );
  assert.equal(options.json, false);
  assert.equal(options.encoding, 'arraybuffer');
  const item = output[0][0];
  assert.deepEqual(item.json, {});
  assert.equal(item.binary.data.data, Buffer.from('MEDIABYTES').toString('base64'));
});

test('status/getMedia asks for raw bytes instead of JSON', async () => {
  const { ctx } = await run(
    { resource: 'status', operation: 'getMedia', sessionId: 'abc-123', statusId: 's1' },
    { response: Buffer.from('MEDIABYTES') },
  );
  const { options } = singleCall(ctx);
  assert.equal(options.json, false, 'media bytes must not be JSON-parsed');
  assert.equal(options.encoding, 'arraybuffer');
});

test('status/getMedia returns the bytes as binary, not on json', async () => {
  const { output } = await run(
    { resource: 'status', operation: 'getMedia', sessionId: 'abc-123', statusId: 's1' },
    { response: Buffer.from('MEDIABYTES') },
  );
  const item = output[0][0];
  assert.deepEqual(item.json, {}, 'raw bytes must not be cast onto json');
  assert.equal(item.binary.data.data, Buffer.from('MEDIABYTES').toString('base64'));
  assert.deepEqual(item.pairedItem, { item: 0 });
});

test('status/getMedia reports a non-binary body instead of throwing a TypeError', async () => {
  await assert.rejects(
    run(
      { resource: 'status', operation: 'getMedia', sessionId: 'abc-123', statusId: 's1' },
      { response: { error: 'not bytes' } },
    ),
    /Expected media bytes/,
  );
});

test('status/getMedia honours a custom output field name', async () => {
  const { output } = await run(
    {
      resource: 'status',
      operation: 'getMedia',
      sessionId: 'abc-123',
      statusId: 's1',
      binaryPropertyName: 'poster',
    },
    { response: Buffer.from('MEDIABYTES') },
  );
  assert.ok(output[0][0].binary.poster, 'expected the media under the chosen field');
  assert.equal(output[0][0].binary.data, undefined);
});

// --- Query string ------------------------------------------------------------
// The mapping table above asserts method/url/body only, so cover qs separately.

test('group/list forwards limit and offset as query parameters', async () => {
  const { ctx } = await run({
    resource: 'group',
    operation: 'list',
    sessionId: 'abc-123',
    groupListOptions: { limit: 50, offset: 100 },
  });
  assert.deepEqual(singleCall(ctx).options.qs, { limit: 50, offset: 100 });
});

test('group/list forwards offset 0 instead of dropping it as falsy', async () => {
  const { ctx } = await run({
    resource: 'group',
    operation: 'list',
    sessionId: 'abc-123',
    groupListOptions: { offset: 0 },
  });
  assert.deepEqual(singleCall(ctx).options.qs, { offset: 0 });
});

test('an operation without query parameters sends no qs at all', async () => {
  const { ctx } = await run({ resource: 'group', operation: 'list', sessionId: 'abc-123' });
  assert.equal(singleCall(ctx).options.qs, undefined);
});

// --- List inputs -------------------------------------------------------------
// These fields are plain strings, not `multipleValues` collections, so that an
// expression can supply a list only known at runtime. Three shapes must work.

test('a list field accepts a comma-separated string', async () => {
  const { ctx } = await run({
    resource: 'group',
    operation: 'addParticipants',
    sessionId: 'abc-123',
    groupId: '120363021234567890@g.us',
    groupParticipants: '1@c.us, 2@c.us ,3@c.us',
  });
  assert.deepEqual(singleCall(ctx).options.body, {
    participants: ['1@c.us', '2@c.us', '3@c.us'],
  });
});

test('a list field accepts a JSON array string', async () => {
  const { ctx } = await run({
    resource: 'group',
    operation: 'addParticipants',
    sessionId: 'abc-123',
    groupId: '120363021234567890@g.us',
    groupParticipants: '["1@c.us","2@c.us"]',
  });
  assert.deepEqual(singleCall(ctx).options.body, { participants: ['1@c.us', '2@c.us'] });
});

test('a list field accepts a real array from a resolved expression', async () => {
  const { ctx } = await run({
    resource: 'group',
    operation: 'addParticipants',
    sessionId: 'abc-123',
    groupId: '120363021234567890@g.us',
    groupParticipants: ['1@c.us', '2@c.us'],
  });
  assert.deepEqual(singleCall(ctx).options.body, { participants: ['1@c.us', '2@c.us'] });
});

test('a list field splits on newlines as well as commas', async () => {
  const { ctx } = await run({
    resource: 'group',
    operation: 'addParticipants',
    sessionId: 'abc-123',
    groupId: '120363021234567890@g.us',
    groupParticipants: '1@c.us\n2@c.us\n\n',
  });
  assert.deepEqual(singleCall(ctx).options.body, { participants: ['1@c.us', '2@c.us'] });
});

test('a malformed JSON array falls back to separator splitting instead of failing', async () => {
  const { ctx } = await run({
    resource: 'group',
    operation: 'addParticipants',
    sessionId: 'abc-123',
    groupId: '120363021234567890@g.us',
    groupParticipants: '[1@c.us, 2@c.us',
  });
  assert.deepEqual(singleCall(ctx).options.body, { participants: ['[1@c.us', '2@c.us'] });
});

test('poll options accept a comma-separated string', async () => {
  const { ctx } = await run({
    resource: 'message',
    operation: 'sendPoll',
    sessionId: 'abc-123',
    chatId: '1@c.us',
    pollName: 'Lunch?',
    pollOptions: 'Pizza, Sushi, Salad',
  });
  assert.deepEqual(singleCall(ctx).options.body.options, ['Pizza', 'Sushi', 'Salad']);
});

test('mentions accept a comma-separated string', async () => {
  const { ctx } = await run({
    resource: 'message',
    operation: 'sendText',
    sessionId: 'abc-123',
    chatId: '1@c.us',
    message: 'hi @628123456789',
    mentions: '628123456789@c.us, 628987654321@c.us',
  });
  assert.deepEqual(singleCall(ctx).options.body.mentions, [
    '628123456789@c.us',
    '628987654321@c.us',
  ]);
});

test('an empty list field sends no list at all', async () => {
  const { ctx } = await run({
    resource: 'message',
    operation: 'sendText',
    sessionId: 'abc-123',
    chatId: '1@c.us',
    message: 'hi',
    mentions: '',
  });
  assert.equal(singleCall(ctx).options.body.mentions, undefined);
});

test('contact/getProfilePictures joins the ids into one comma-separated parameter', async () => {
  const { ctx } = await run({
    resource: 'contact',
    operation: 'getProfilePictures',
    sessionId: 'abc-123',
    contactIds: ['1@c.us', ' 2@c.us ', ''],
  });
  assert.deepEqual(singleCall(ctx).options.qs, { ids: '1@c.us,2@c.us' });
});

test('message/list forwards its filters', async () => {
  const { ctx } = await run({
    resource: 'message',
    operation: 'list',
    sessionId: 'abc-123',
    messageListOptions: { chatId: '1@c.us', limit: 10 },
  });
  assert.deepEqual(singleCall(ctx).options.qs, { chatId: '1@c.us', limit: 10 });
});

test('message/list forwards the v0.23.4 cursor and the inline-media opt-out', async () => {
  const { ctx } = await run({
    resource: 'message',
    operation: 'list',
    sessionId: 'abc-123',
    messageListOptions: { after: 'msg-9', inlineMedia: false, limit: 100 },
  });
  // `false` has to survive: the server reads the opt-out as the literal string
  // 'false', so dropping the key would silently keep inlining every payload.
  assert.deepEqual(singleCall(ctx).options.qs, {
    after: 'msg-9',
    inlineMedia: false,
    limit: 100,
  });
});

test('message/list keeps inlineMedia true when the user leaves the default alone', async () => {
  const { ctx } = await run({
    resource: 'message',
    operation: 'list',
    sessionId: 'abc-123',
    messageListOptions: { inlineMedia: true },
  });
  assert.deepEqual(singleCall(ctx).options.qs, { inlineMedia: true });
});

test('message/getHistory forwards a false boolean instead of dropping it', async () => {
  const { ctx } = await run({
    resource: 'message',
    operation: 'getHistory',
    sessionId: 'abc-123',
    chatId: '1@c.us',
    historyOptions: { includeMedia: false, deep: true },
  });
  assert.deepEqual(singleCall(ctx).options.qs, { includeMedia: false, deep: true });
});

test('system/search sends the query alongside its filters', async () => {
  const { ctx } = await run({
    resource: 'system',
    operation: 'search',
    searchQuery: '  invoice ',
    searchFilters: { sessionId: 'abc-123', limit: 5 },
  });
  assert.deepEqual(singleCall(ctx).options.qs, {
    q: 'invoice',
    sessionId: 'abc-123',
    limit: 5,
  });
});

// SearchQueryDto binds dateFrom/dateTo as epoch-ms numbers, but the UI fields are
// `dateTime`, which hand over ISO-8601. Forwarding that string fails validation,
// so every date-filtered search would 400.
test('system/search converts ISO dates to the epoch-ms the API binds', async () => {
  const { ctx } = await run({
    resource: 'system',
    operation: 'search',
    searchQuery: 'invoice',
    searchFilters: { dateFrom: '2026-07-01T00:00:00.000Z', dateTo: '2026-07-31T23:59:59.000Z' },
  });
  assert.deepEqual(singleCall(ctx).options.qs, {
    q: 'invoice',
    dateFrom: Date.parse('2026-07-01T00:00:00.000Z'),
    dateTo: Date.parse('2026-07-31T23:59:59.000Z'),
  });
});

test('system/search passes an epoch-ms number through untouched', async () => {
  const { ctx } = await run({
    resource: 'system',
    operation: 'search',
    searchQuery: 'invoice',
    searchFilters: { dateFrom: 1782000000000 },
  });
  assert.equal(singleCall(ctx).options.qs.dateFrom, 1782000000000);
});

test('system/search rejects an unparseable date instead of sending NaN', async () => {
  await assert.rejects(
    run({
      resource: 'system',
      operation: 'search',
      searchQuery: 'invoice',
      searchFilters: { dateFrom: 'last tuesday' },
    }),
    /Date From is not a valid date/,
  );
});

test('system/getAudit renames the keyId field back to the wire name apiKeyId', async () => {
  const { ctx } = await run({
    resource: 'system',
    operation: 'getAudit',
    auditFilters: { keyId: 'k1', severity: 'high' },
  });
  const { qs } = singleCall(ctx).options;
  assert.deepEqual(qs, { severity: 'high', apiKeyId: 'k1' });
  assert.equal(qs.keyId, undefined, 'the UI-only field name must not reach the API');
});

test('webhook/listAll has no session filter to leak', async () => {
  // GET /api/webhooks binds only limit and offset, so its options collection
  // must not offer a sessionId the server would silently ignore.
  const { ctx } = await run({
    resource: 'webhook',
    operation: 'listAll',
    webhookListOptions: { limit: 5, offset: 10 },
  });
  assert.deepEqual(singleCall(ctx).options.qs, { limit: 5, offset: 10 });
});

test('webhook/getDeliveryFailures reads its own options, not the List All ones', async () => {
  const { ctx } = await run({
    resource: 'webhook',
    operation: 'getDeliveryFailures',
    deliveryFailureOptions: { sessionId: 'abc-123', limit: 5 },
    // Set on the other collection to prove it is not the one being read.
    webhookListOptions: { offset: 999 },
  });
  assert.deepEqual(singleCall(ctx).options.qs, { sessionId: 'abc-123', limit: 5 });
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

// --- Expression-typed input: a text field can receive a number, null or an object.
// Every one of these crashed with an opaque "x.trim is not a function" before the
// fields were routed through asText().
const coercionCases = [
  [
    'message/sendTemplate coerces a numeric Template Name',
    { resource: 'message', operation: 'sendTemplate', sessionId: 'abc-123', chatId: '1@c.us', sendTemplateName: 42 },
    (body) => assert.equal(body.templateName, '42'),
  ],
  [
    'contact/save drops a null Last Name instead of throwing',
    {
      resource: 'contact',
      operation: 'save',
      sessionId: 'abc-123',
      contactId: '1@c.us',
      contactFirstName: 'Ada',
      contactLastName: null,
    },
    (body) => assert.deepEqual(body, { firstName: 'Ada' }),
  ],
  [
    'status/sendText coerces a numeric Background Color',
    { resource: 'status', operation: 'sendText', sessionId: 'abc-123', statusText: 'hi', statusBackgroundColor: 123456 },
    (body) => assert.equal(body.backgroundColor, '123456'),
  ],
  [
    'group/updateDescription coerces a numeric description',
    { resource: 'group', operation: 'updateDescription', sessionId: 'abc-123', groupId: 'g@g.us', groupDescription: 2026 },
    (body) => assert.deepEqual(body, { description: '2026' }),
  ],
  [
    'channel/create coerces a numeric description',
    { resource: 'channel', operation: 'create', sessionId: 'abc-123', channelName: 'c', channelDescription: 7 },
    (body) => assert.equal(body.description, '7'),
  ],
];

for (const [label, params, check] of coercionCases) {
  test(label, async () => {
    const { ctx } = await run(params);
    check(singleCall(ctx).options.body ?? {});
  });
}

test('a shapeless object is refused on any text field, and the message names it', async () => {
  // asText is shared by ~50 call sites, so this is the guard that closes Edit,
  // captions and Status, not just the two message-body sites below.
  await assert.rejects(
    () =>
      run({
        resource: 'message',
        operation: 'edit',
        sessionId: 'abc-123',
        chatId: '1@c.us',
        messageId: 'm1',
        message: { text: 'hi' },
      }),
    /Message must be text/,
  );
  await assert.rejects(
    () =>
      run({
        resource: 'group',
        operation: 'updateSubject',
        sessionId: 'abc-123',
        groupId: 'g@g.us',
        groupSubject: { t: 'x' },
      }),
    /Subject must be text/,
  );
});

test('a date object on a text field still sends the timestamp it stringifies to', async () => {
  // A bare {{ $now }} on a string field resolves to a Luxon DateTime OBJECT, not a
  // string. Refusing every object would break that, and a plain Date with it.
  const when = new Date(Date.UTC(2026, 8, 5, 10, 0, 0));
  const { ctx } = await run({
    resource: 'group',
    operation: 'updateSubject',
    sessionId: 'abc-123',
    groupId: 'g@g.us',
    groupSubject: when,
  });
  assert.equal(singleCall(ctx).options.body.subject, String(when));
});

test('an object with no toString at all is refused rather than crashing', async () => {
  const shapeless = Object.create(null);
  shapeless.a = 1;
  await assert.rejects(
    () =>
      run({
        resource: 'group',
        operation: 'updateSubject',
        sessionId: 'abc-123',
        groupId: 'g@g.us',
        groupSubject: shapeless,
      }),
    /Subject must be text/,
  );
});

test('apiKey/create refuses an expiry beyond a century, which is what a microsecond epoch looks like', async () => {
  // ~1.79e15 sits inside the +/-8.64e15 Date itself accepts, so only the century
  // ceiling catches it. Without that it reached the gateway as a year-58648 date.
  await assert.rejects(
    () =>
      run({
        resource: 'apiKey',
        operation: 'create',
        keyName: 'ops',
        keyFields: { expiresAt: 1.79e15 },
      }),
    /Expiry date is not a valid date/,
  );
});

test('message/sendText refuses an object body instead of sending [object Object]', async () => {
  // The gateway validates with enableImplicitConversion, which rewrites the value
  // before @IsString() sees it, so an object arrives at WhatsApp as literal text.
  // A sent message cannot be recalled, so the refusal has to happen here.
  await assert.rejects(
    () =>
      run({
        resource: 'message',
        operation: 'sendText',
        sessionId: 'abc-123',
        chatId: '1@c.us',
        message: { payload: 'hi' },
      }),
    /Message must be text/,
  );
});

test('message/reply refuses an array body for the same reason', async () => {
  await assert.rejects(
    () =>
      run({
        resource: 'message',
        operation: 'reply',
        sessionId: 'abc-123',
        chatId: '1@c.us',
        quotedMessageId: 'm1',
        message: ['a', 'b'],
      }),
    /Message must be text/,
  );
});

test('a pasted JSON array of objects is refused, not chopped on its commas', async () => {
  // The guard used to sit inside the JSON.parse try, so it was swallowed and the
  // raw text fell through to the comma splitter, sending JSON fragments as JIDs.
  await assert.rejects(
    () =>
      run({
        resource: 'group',
        operation: 'addParticipants',
        sessionId: 'abc-123',
        groupId: 'g@g.us',
        groupParticipants: '[{"id":"628111@c.us"},{"id":"628222@c.us"}]',
      }),
    /List entries must be text/,
  );
});

test('a pasted JSON array of strings still works', async () => {
  const { ctx } = await run({
    resource: 'group',
    operation: 'addParticipants',
    sessionId: 'abc-123',
    groupId: 'g@g.us',
    groupParticipants: '["628111@c.us","628222@c.us"]',
  });
  assert.deepEqual(singleCall(ctx).options.body, {
    participants: ['628111@c.us', '628222@c.us'],
  });
});

test('apiKey/create refuses an expiry that is already past', async () => {
  // Seconds-scale epoch input resolves to 1970 and would create a key that is dead
  // on arrival while the request answers 200.
  await assert.rejects(
    () =>
      run({
        resource: 'apiKey',
        operation: 'create',
        keyName: 'ops',
        keyFields: { expiresAt: 1798761600 },
      }),
    /Expiry date must be in the future/,
  );
});

test('apiKey/create refuses an epoch too large for a Date', async () => {
  await assert.rejects(
    () =>
      run({
        resource: 'apiKey',
        operation: 'create',
        keyName: 'ops',
        keyFields: { expiresAt: '1830297599000000000' },
      }),
    /Expiry date is not a valid date/,
  );
});

test('apiKey/create normalises a real future expiry to an ISO string', async () => {
  const future = Date.now() + 86400000;
  const { ctx } = await run({
    resource: 'apiKey',
    operation: 'create',
    keyName: 'ops',
    keyFields: { expiresAt: future },
  });
  assert.deepEqual(singleCall(ctx).options.body, {
    name: 'ops',
    expiresAt: new Date(future).toISOString(),
  });
});

test('message/sendText coerces a numeric message body without trimming it', async () => {
  const { ctx } = await run({
    resource: 'message',
    operation: 'sendText',
    sessionId: 'abc-123',
    chatId: '1@c.us',
    message: 2026,
  });
  assert.equal(singleCall(ctx).options.body.text, '2026');
});

test('message/sendText keeps whitespace a user put in the message body', async () => {
  const { ctx } = await run({
    resource: 'message',
    operation: 'sendText',
    sessionId: 'abc-123',
    chatId: '1@c.us',
    message: 'Invoice attached\n\n  Regards, Ada  ',
  });
  // Trimming here would eat the blank line before a signature, which is content.
  assert.equal(singleCall(ctx).options.body.text, 'Invoice attached\n\n  Regards, Ada  ');
});

test('message/sendText coerces a numeric custom link preview title', async () => {
  const { ctx } = await run({
    resource: 'message',
    operation: 'sendText',
    sessionId: 'abc-123',
    chatId: '1@c.us',
    message: 'hi',
    customLinkPreview: { previewUrl: 'https://e.com', previewTitle: 2026 },
  });
  assert.deepEqual(singleCall(ctx).options.body.customLinkPreview, {
    url: 'https://e.com',
    title: '2026',
  });
});

test('chat/mute reads an epoch-ms string as the instant it is, not as a year', async () => {
  const { ctx } = await run({
    resource: 'chat',
    operation: 'mute',
    sessionId: 'abc-123',
    chatId: '1@c.us',
    muteUntil: '1798761600000',
  });
  // Date.parse answers NaN for a 13-digit string, so this used to be refused as
  // "not a valid date" even though it is exactly the number the route wants.
  assert.deepEqual(singleCall(ctx).options.body, {
    chatId: '1@c.us',
    muteUntil: 1798761600000,
  });
});

test('chat/mute refuses a seconds-scale timestamp instead of muting until 1970', async () => {
  // Ten digits is epoch-SECONDS. Read as milliseconds it lands in January 1970, so the
  // gateway answers 200 for a mute that expired decades ago and the chat stays unmuted.
  await assert.rejects(
    () =>
      run({
        resource: 'chat',
        operation: 'mute',
        sessionId: 'abc-123',
        chatId: '1@c.us',
        muteUntil: '1798761600',
      }),
    /Mute Until is not a valid date/,
  );
});

test('chat/mute still accepts an ISO instant from the date picker', async () => {
  const { ctx } = await run({
    resource: 'chat',
    operation: 'mute',
    sessionId: 'abc-123',
    chatId: '1@c.us',
    muteUntil: '2026-09-05T10:00:00.000Z',
  });
  assert.equal(singleCall(ctx).options.body.muteUntil, Date.parse('2026-09-05T10:00:00.000Z'));
});

test('a binary route asks for raw bytes and leaves the MIME type to n8n', async () => {
  const { ctx, output } = await run(
    { resource: 'message', operation: 'getMedia', sessionId: 'abc-123', chatId: '1@c.us', messageId: 'm1' },
    { response: Buffer.from('PDFBYTES') },
  );
  assert.equal(singleCall(ctx).options.encoding, 'arraybuffer');
  // No mimeType argument: the gateway serves every document as application/octet-stream
  // (its inertMimetype allowlist), and passing that on would suppress the byte sniffing
  // that recovers application/pdf and the .pdf extension.
  assert.deepEqual(ctx.prepared, [{ buffer: 'PDFBYTES', mimeType: undefined }]);
  assert.equal(output[0][0].binary.data.data, Buffer.from('PDFBYTES').toString('base64'));
});

test('continueOnFail keeps the explanation the server sent, not just the status line', async () => {
  const axiosLike = Object.assign(new Error('Request failed with status code 404'), {
    response: { data: { message: 'Message has no downloadable media' } },
  });
  const { output } = await run(
    { resource: 'message', operation: 'getMedia', sessionId: 'abc-123', chatId: '1@c.us', messageId: 'm1' },
    { throwErr: axiosLike, continueOnFail: true },
  );
  assert.equal(output[0].length, 1);
  assert.match(output[0][0].json.description, /Message has no downloadable media/);
});

test('a binary 404 body is decoded out of the bytes it arrived as', async () => {
  const axiosLike = Object.assign(new Error('Request failed with status code 404'), {
    response: { data: Buffer.from(JSON.stringify({ message: 'Message has no downloadable media' })) },
  });
  await assert.rejects(
    () =>
      run(
        { resource: 'message', operation: 'getMedia', sessionId: 'abc-123', chatId: '1@c.us', messageId: 'm1' },
        { throwErr: axiosLike },
      ),
    (err) => {
      assert.match(err.description, /Message has no downloadable media/);
      return true;
    },
  );
});

test('a binary 404 is still decoded when n8n hands over an already-wrapped error', async () => {
  // What the running helper actually throws: the raw request failure is parked on
  // `cause` and the undecoded bytes on `context.data`, and the message has already
  // been computed from bytes nothing could read.
  const node = { id: 'node-1', name: 'OpenWA', type: 'n8n-nodes-openwa.openWa', typeVersion: 1, position: [0, 0], parameters: {} };
  const axiosLike = Object.assign(new Error('Request failed with status code 404'), {
    response: {
      status: 404,
      data: Buffer.from(JSON.stringify({ message: 'Message has no downloadable media' })),
    },
  });
  const wrapped = new NodeApiError(node, axiosLike);
  await assert.rejects(
    () =>
      run(
        { resource: 'message', operation: 'getMedia', sessionId: 'abc-123', chatId: '1@c.us', messageId: 'm1' },
        { throwErr: wrapped },
      ),
    (err) => {
      assert.match(err.description, /Message has no downloadable media/);
      return true;
    },
  );
});

test('continueOnFail keeps a class-validator 400, whose message is an array', async () => {
  // NestJS sends a validation rejection as message: string[]. A string-only guard
  // drops it and the user is left with the bare status line.
  const axiosLike = Object.assign(new Error('Request failed with status code 400'), {
    response: {
      status: 400,
      data: {
        message: ['Session name can only contain letters, numbers, and hyphens'],
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  });
  const { output } = await run(
    { resource: 'session', operation: 'create', sessionName: 'my bot' },
    { throwErr: axiosLike, continueOnFail: true },
  );
  assert.match(output[0][0].json.description, /letters, numbers, and hyphens/);
});

test('a SHORT proxy HTML page is rejected on being markup, not on length', async () => {
  // Deliberately under the 300-character cap, so only the markup guard can reject it.
  const page = '<html>\r\n<head><title>502 Bad Gateway</title></head>\r\n<body><center><h1>502 Bad Gateway</h1></center><hr><center>nginx</center></body>\r\n</html>';
  assert.ok(page.length < 300, 'fixture must be under the length cap to isolate the markup guard');
  const axiosLike = Object.assign(new Error('Request failed with status code 502'), {
    response: { status: 502, data: Buffer.from(page) },
  });
  await assert.rejects(
    () =>
      run(
        { resource: 'message', operation: 'getMedia', sessionId: 'abc-123', chatId: '1@c.us', messageId: 'm1' },
        { throwErr: axiosLike },
      ),
    (err) => {
      assert.ok(
        typeof err.description !== 'string' || !err.description.includes('<html'),
        'an HTML page must not become the description',
      );
      return true;
    },
  );
});

test('a long plain-text body is rejected on length, not on being markup', async () => {
  // No leading '<', so only the length cap can reject it.
  const wall = 'gateway timeout: '.repeat(40);
  assert.ok(wall.length > 300 && !wall.startsWith('<'));
  const axiosLike = Object.assign(new Error('Request failed with status code 504'), {
    response: { status: 504, data: Buffer.from(wall) },
  });
  await assert.rejects(
    () =>
      run(
        { resource: 'message', operation: 'getMedia', sessionId: 'abc-123', chatId: '1@c.us', messageId: 'm1' },
        { throwErr: axiosLike },
      ),
    (err) => {
      assert.ok(!String(err.description ?? '').includes('gateway timeout'));
      return true;
    },
  );
});

test('a request failure names the item it belongs to', async () => {
  const axiosLike = Object.assign(new Error('Request failed with status code 500'), {
    response: { status: 500, data: { message: 'engine down' } },
  });
  await assert.rejects(
    () =>
      run(
        { resource: 'session', operation: 'listAll' },
        { throwErr: axiosLike, throwOnCall: 2, items: 3 },
      ),
    (err) => {
      assert.equal(err.context.itemIndex, 1, 'the second item is index 1');
      return true;
    },
  );
});

test('a short plain-text body from an intermediary is still worth surfacing', async () => {
  const axiosLike = Object.assign(new Error('Request failed with status code 502'), {
    response: { status: 502, data: Buffer.from('Bad Gateway') },
  });
  await assert.rejects(
    () =>
      run(
        { resource: 'message', operation: 'getMedia', sessionId: 'abc-123', chatId: '1@c.us', messageId: 'm1' },
        { throwErr: axiosLike },
      ),
    (err) => {
      assert.equal(err.description, 'Bad Gateway');
      return true;
    },
  );
});

test('a rejection with no shape is still reported as a failed request', async () => {
  // NodeApiError reads .message off its argument, so a null rejection used to
  // surface as "Cannot read properties of null" on both the throw path and the
  // Continue On Fail path, replacing the failure with a null-dereference notice.
  const { output } = await run(
    { resource: 'session', operation: 'listAll' },
    { throwErr: null, continueOnFail: true, throwFalsy: true },
  );
  assert.match(output[0][0].json.error, /failed without returning a response/);
});

test('a parameter mistake is a NodeOperationError, not a gateway failure', async () => {
  // sanitizePathParam throws a bare Error. Reported as a NodeApiError it read as a
  // gateway fault, sending the user to look at a server that was never contacted.
  await assert.rejects(
    () => run({ resource: 'session', operation: 'getStatus', sessionId: '  ' }),
    (err) => {
      assert.equal(err.constructor.name, 'NodeOperationError');
      assert.match(err.message, /Session ID cannot be empty/);
      return true;
    },
  );
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
    /Phone number must be digits in international format/,
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
    'group/create rejects an empty group name',
    {
      resource: 'group',
      operation: 'create',
      sessionId: 'abc-123',
      groupName: '  ',
      groupParticipants: ['1@c.us'],
    },
    /Group name cannot be empty/,
  ],
  [
    'group/create rejects an empty participant list',
    {
      resource: 'group',
      operation: 'create',
      sessionId: 'abc-123',
      groupName: 'Team',
      groupParticipants: [],
    },
    /At least one participant is required/,
  ],
  [
    'group/addParticipants rejects a list of only blanks',
    {
      resource: 'group',
      operation: 'addParticipants',
      sessionId: 'abc-123',
      groupId: '120363021234567890@g.us',
      groupParticipants: ['  ', ''],
    },
    /At least one participant is required/,
  ],
  [
    'group/create rejects more than 256 participants',
    {
      resource: 'group',
      operation: 'create',
      sessionId: 'abc-123',
      groupName: 'Team',
      groupParticipants: Array.from({ length: 257 }, (_, n) => `${n}@c.us`),
    },
    /cannot exceed 256 entries/,
  ],
  [
    'group/create rejects a name over 100 characters',
    {
      resource: 'group',
      operation: 'create',
      sessionId: 'abc-123',
      groupName: 'x'.repeat(101),
      groupParticipants: ['1@c.us'],
    },
    /Group name cannot exceed 100 characters/,
  ],
  [
    'group/updateSubject rejects a subject over 100 characters',
    {
      resource: 'group',
      operation: 'updateSubject',
      sessionId: 'abc-123',
      groupId: '120363021234567890@g.us',
      groupSubject: 'x'.repeat(101),
    },
    /Subject cannot exceed 100 characters/,
  ],
  [
    'group/updateDescription rejects a description over 1024 characters',
    {
      resource: 'group',
      operation: 'updateDescription',
      sessionId: 'abc-123',
      groupId: '120363021234567890@g.us',
      groupDescription: 'x'.repeat(1025),
    },
    /Description cannot exceed 1024 characters/,
  ],
  [
    'group operations reject an empty group id',
    { resource: 'group', operation: 'get', sessionId: 'abc-123', groupId: '  ' },
    /Group ID cannot be empty/,
  ],
  [
    'group/join rejects an empty invite code',
    { resource: 'group', operation: 'join', sessionId: 'abc-123', groupInviteCode: '  ' },
    /Invite code cannot be empty/,
  ],
  [
    'group/join rejects an invite link with no code after it',
    {
      resource: 'group',
      operation: 'join',
      sessionId: 'abc-123',
      groupInviteCode: 'https://chat.whatsapp.com/',
    },
    /Invite code cannot be empty/,
  ],
  [
    'group/updateSubject rejects an empty subject',
    {
      resource: 'group',
      operation: 'updateSubject',
      sessionId: 'abc-123',
      groupId: '120363021234567890@g.us',
      groupSubject: '   ',
    },
    /Subject cannot be empty/,
  ],
  [
    'group/updateSettings rejects an empty patch',
    {
      resource: 'group',
      operation: 'updateSettings',
      sessionId: 'abc-123',
      groupId: '120363021234567890@g.us',
      groupSettings: {},
    },
    /At least one setting must be provided/,
  ],
  [
    'an unknown group operation fails with a clear message',
    {
      resource: 'group',
      operation: 'bogus',
      sessionId: 'abc-123',
      groupId: '120363021234567890@g.us',
    },
    /Unsupported resource\/operation: group\/bogus/,
  ],
  [
    'message/sendPoll rejects a single option',
    {
      resource: 'message',
      operation: 'sendPoll',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      pollName: 'Q',
      pollOptions: ['only one'],
    },
    /between 2 and 12 options/,
  ],
  [
    'message/sendPoll rejects more than twelve options',
    {
      resource: 'message',
      operation: 'sendPoll',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      pollName: 'Q',
      pollOptions: Array.from({ length: 13 }, (_, n) => `opt ${n}`),
    },
    /between 2 and 12 options/,
  ],
  [
    'message/sendTemplate rejects having neither an id nor a name',
    {
      resource: 'message',
      operation: 'sendTemplate',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      sendTemplateId: '',
      sendTemplateName: '',
    },
    /either a Template ID or a Template Name/,
  ],
  [
    'message/sendTemplate rejects invalid variables JSON',
    {
      resource: 'message',
      operation: 'sendTemplate',
      sessionId: 'abc-123',
      chatId: '1@c.us',
      sendTemplateId: 't1',
      templateVars: '{bad',
    },
    /Template variables must be valid JSON/,
  ],
  [
    'message/forward rejects an empty source chat',
    {
      resource: 'message',
      operation: 'forward',
      sessionId: 'abc-123',
      fromChatId: '  ',
      toChatId: '2@c.us',
      messageId: 'm1',
    },
    /From Chat ID cannot be empty/,
  ],
  [
    'contact/getProfilePictures rejects an empty id list',
    {
      resource: 'contact',
      operation: 'getProfilePictures',
      sessionId: 'abc-123',
      contactIds: [],
    },
    /At least one contact ID is required/,
  ],
  [
    'contact/getProfilePictures refuses more ids than the server will use',
    {
      resource: 'contact',
      operation: 'getProfilePictures',
      sessionId: 'abc-123',
      contactIds: Array.from({ length: 51 }, (_, n) => `${n}@c.us`),
    },
    /cannot exceed 50 entries/,
  ],
  [
    'profile/setName rejects a name over the WhatsApp limit',
    {
      resource: 'profile',
      operation: 'setName',
      sessionId: 'abc-123',
      profileName: 'x'.repeat(26),
    },
    /Name cannot exceed 25 characters/,
  ],
  [
    'profile/setStatus rejects an about text over the WhatsApp limit',
    {
      resource: 'profile',
      operation: 'setStatus',
      sessionId: 'abc-123',
      profileStatus: 'x'.repeat(140),
    },
    /Status cannot exceed 139 characters/,
  ],
  [
    'status/sendText rejects more than 256 recipients',
    {
      resource: 'status',
      operation: 'sendText',
      sessionId: 'abc-123',
      statusText: 'hi',
      statusRecipients: Array.from({ length: 257 }, (_, n) => `${n}@c.us`),
    },
    /Recipients cannot exceed 256 entries/,
  ],
  [
    'template/create rejects an empty body',
    {
      resource: 'template',
      operation: 'create',
      sessionId: 'abc-123',
      templateName: 'welcome',
      templateBody: '   ',
    },
    /Template body cannot be empty/,
  ],
  [
    'template/update rejects an empty patch',
    {
      resource: 'template',
      operation: 'update',
      sessionId: 'abc-123',
      templateId: 't1',
      templateUpdateFields: {},
    },
    /At least one field must be provided/,
  ],
  [
    'channel/subscribe rejects a link with no code after it',
    {
      resource: 'channel',
      operation: 'subscribe',
      sessionId: 'abc-123',
      channelInviteCode: 'https://whatsapp.com/channel/',
    },
    /Invite code cannot be empty/,
  ],
  [
    'system/search rejects an empty query',
    { resource: 'system', operation: 'search', searchQuery: '   ' },
    /Search query cannot be empty/,
  ],
  [
    'apiKey/update rejects an empty patch',
    { resource: 'apiKey', operation: 'update', keyId: 'k1', keyFields: {} },
    /At least one field must be provided/,
  ],
  [
    'webhook/create rejects a secret shorter than 16 characters',
    {
      resource: 'webhook',
      operation: 'create',
      sessionId: 'abc-123',
      webhookUrl: 'https://n8n.example/hook',
      events: ['message.received'],
      webhookSecret: 's3cr3t',
    },
    /at least 16 characters/,
  ],
  [
    'webhook/update rejects a secret shorter than 16 characters',
    {
      resource: 'webhook',
      operation: 'update',
      sessionId: 'abc-123',
      webhookId: 'w1',
      updateFields: { secret: 'short' },
    },
    /at least 16 characters/,
  ],
  [
    'webhook/create rejects a secret longer than 255 characters',
    {
      resource: 'webhook',
      operation: 'create',
      sessionId: 'abc-123',
      webhookUrl: 'https://n8n.example/hook',
      events: ['message.received'],
      webhookSecret: 'x'.repeat(256),
    },
    /cannot exceed 255 characters/,
  ],
  [
    'chat/markRead rejects more than 100 message ids',
    {
      resource: 'chat',
      operation: 'markRead',
      sessionId: 'abc-123',
      chatId: '628123456789@c.us',
      readMessageIds: Array.from({ length: 101 }, (_, i) => `m${i}`),
    },
    /at most 100 message IDs/,
  ],
  [
    'template/update refuses a blank name instead of silently dropping it',
    // `name` and `body` are IsNotEmpty on the server, so a blank one cannot mean
    // anything. Dropping it would report success while the name stayed as it was.
    {
      resource: 'template',
      operation: 'update',
      sessionId: 'abc-123',
      templateId: 't1',
      templateUpdateFields: { name: '   ' },
    },
    /Template name cannot be blank/,
  ],
  [
    'template/update refuses a blank name even when another field is set',
    // This is the case that used to succeed while quietly ignoring the name.
    {
      resource: 'template',
      operation: 'update',
      sessionId: 'abc-123',
      templateId: 't1',
      templateUpdateFields: { name: '', body: 'new body' },
    },
    /Template name cannot be blank/,
  ],
  [
    'label/upsert refuses a blank name even when a colour is set',
    {
      resource: 'label',
      operation: 'upsert',
      sessionId: 'abc-123',
      newLabelId: 'l9',
      labelFields: { labelName: '  ', labelColor: 3 },
    },
    /Label name cannot be blank/,
  ],
  [
    'automationRule/update refuses a blank reply text even when Enabled is set',
    {
      resource: 'automationRule',
      operation: 'update',
      sessionId: 'abc-123',
      ruleId: 'r1',
      ruleUpdateFields: { replyText: '', enabled: true },
    },
    /Reply text cannot be blank/,
  ],
  [
    'session/create rejects a proxy URL with no scheme',
    { resource: 'session', operation: 'create', sessionName: 'sales', proxyUrl: '127.0.0.1:1080' },
    /must start with http:\/\//,
  ],
  [
    'session/updateConfig rejects an empty patch',
    { resource: 'session', operation: 'updateConfig', sessionId: 'abc-123', sessionConfigFields: {} },
    /At least one field must be provided/,
  ],
  [
    'presence/subscribe rejects a bare phone number',
    { resource: 'presence', operation: 'subscribe', sessionId: 'abc-123', chatId: '628123456789' },
    /full WhatsApp ID including its domain/,
  ],
  [
    'message/votePoll rejects more than twelve selections',
    {
      resource: 'message',
      operation: 'votePoll',
      sessionId: 'abc-123',
      chatId: '628123456789@c.us',
      messageId: 'm1',
      pollVoteOptions: Array.from({ length: 13 }, (_, i) => `o${i}`),
    },
    /at most 12 options/,
  ],
  [
    'message/sendText refuses a custom preview paired with No Preview',
    {
      resource: 'message',
      operation: 'sendText',
      sessionId: 'abc-123',
      chatId: '628123456789@c.us',
      message: 'x',
      linkPreview: 'no',
      customLinkPreview: { previewUrl: 'https://example.com', previewTitle: 'Example' },
    },
    /cannot be combined with Link Preview set to No Preview/,
  ],
  [
    'message/sendProduct rejects a blank product id',
    {
      resource: 'message',
      operation: 'sendProduct',
      sessionId: 'abc-123',
      chatId: '628123456789@c.us',
      productId: '   ',
    },
    /Product ID/,
  ],
  [
    'label/upsert rejects an empty patch',
    { resource: 'label', operation: 'upsert', sessionId: 'abc-123', newLabelId: 'l9', labelFields: {} },
    /At least one of Name or Color/,
  ],
  [
    'label/addToChat rejects a blank label id instead of sending one',
    {
      resource: 'label',
      operation: 'addToChat',
      sessionId: 'abc-123',
      chatId: '628123456789@c.us',
      labelId: '   ',
    },
    /Label ID/,
  ],
  [
    'contact/save rejects a blank first name',
    {
      resource: 'contact',
      operation: 'save',
      sessionId: 'abc-123',
      contactId: '628123456789@c.us',
      contactFirstName: '  ',
    },
    /First Name/,
  ],
  [
    'chat/mute rejects an unparseable date',
    {
      resource: 'chat',
      operation: 'mute',
      sessionId: 'abc-123',
      chatId: '628123456789@c.us',
      muteUntil: 'not a date',
    },
    /Mute Until is not a valid date/,
  ],
  [
    'webhook/create rejects filters that are not valid JSON',
    {
      resource: 'webhook',
      operation: 'create',
      sessionId: 'abc-123',
      webhookUrl: 'https://n8n.example/hook',
      events: ['message.received'],
      webhookCreateFields: { filters: '{not json' },
    },
    /Filters must be valid JSON/,
  ],
  [
    'automationRule/update rejects an empty patch',
    {
      resource: 'automationRule',
      operation: 'update',
      sessionId: 'abc-123',
      ruleId: 'r1',
      ruleUpdateFields: {},
    },
    /At least one field must be provided/,
  ],
  [
    'automationRule/create rejects conditions that are not valid JSON',
    {
      resource: 'automationRule',
      operation: 'create',
      sessionId: 'abc-123',
      ruleName: 'Greet',
      ruleReplyText: 'Thanks',
      ruleConditions: '{not json',
    },
    /Conditions must be valid JSON/,
  ],
  [
    'session/updateConfig refuses a non-numeric reconnect cap instead of clearing it',
    // NaN < 0 is false, so an unguarded sentinel would send `null` and silently
    // reset the cap to unlimited rather than failing.
    {
      resource: 'session',
      operation: 'updateConfig',
      sessionId: 'abc-123',
      sessionConfigFields: { maxReconnectAttempts: Number.NaN },
    },
    /Max Reconnect Attempts must be a number/,
  ],
  [
    'an unknown resource fails with a clear message',
    { resource: 'bogus', operation: 'x' },
    /Unsupported resource\/operation: bogus\/x/,
  ],
  [
    'session/updateProxy rejects a blank URL rather than sending a no-op PATCH',
    { resource: 'session', operation: 'updateProxy', sessionId: 'abc-123', proxyUrl: '  ' },
    /Proxy URL cannot be empty/,
  ],
  [
    'session/updateProxy rejects an unsupported scheme',
    {
      resource: 'session',
      operation: 'updateProxy',
      sessionId: 'abc-123',
      proxyUrl: 'ftp://proxy.example.com:8080',
    },
    /Proxy URL must start with/,
  ],
  [
    'session/create rejects a scheme with no host behind it',
    { resource: 'session', operation: 'create', sessionName: 's1', proxyUrl: 'socks5://' },
    /Proxy URL must include a host/,
  ],
  [
    'session/create rejects a proxy URL past the column width',
    {
      resource: 'session',
      operation: 'create',
      sessionName: 's1',
      proxyUrl: `http://${'a'.repeat(260)}.example.com`,
    },
    /Proxy URL cannot exceed 255 characters/,
  ],
  [
    'webhook/update refuses a body that would change nothing',
    { resource: 'webhook', operation: 'update', sessionId: 'abc-123', webhookId: 'w1' },
    /At least one field must be provided to update/,
  ],
  [
    // '0' is what Chat > List reports for an indefinite mute. Date.parse reads a
    // short digit string as a year, so without the refusal it becomes the year 2000.
    'chat/mute refuses the indefinite-mute sentinel instead of reading it as a year',
    { resource: 'chat', operation: 'mute', sessionId: 'abc-123', chatId: '1@c.us', muteUntil: '0' },
    /Mute Until is not a valid date/,
  ],
];

// Both toggles below DELETE stored configuration, so they are compared against a
// real `true`. An expression yielding the string 'false' is truthy, and a truthiness
// check would read that refusal as consent.
const strictToggleCases = [
  [
    'session/updateProxy ignores a truthy "false" and still writes the URL',
    {
      resource: 'session',
      operation: 'updateProxy',
      sessionId: 'abc-123',
      proxyClear: 'false',
      proxyUrl: 'socks5://127.0.0.1:1080',
    },
    { proxyUrl: 'socks5://127.0.0.1:1080' },
  ],
  [
    'webhook/update ignores a truthy "false" and keeps the secret',
    {
      resource: 'webhook',
      operation: 'update',
      sessionId: 'abc-123',
      webhookId: 'w1',
      updateFields: { clearSecret: 'false', active: true },
    },
    { active: true },
  ],
];

for (const [label, params, expectedBody] of strictToggleCases) {
  test(label, async () => {
    const { ctx } = await run(params);
    assert.deepEqual(singleCall(ctx).options.body, expectedBody);
  });
}

for (const [label, params, pattern] of guardCases) {
  test(label, async () => {
    await assert.rejects(() => run(params), pattern);
  });
}
