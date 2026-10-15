import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { OpenWa } from '../dist/nodes/OpenWa/OpenWa.node.js';

const snapshot = JSON.parse(
  readFileSync(new URL('./fixtures/openwa-0.25.0.json', import.meta.url)),
);
const { properties } = new OpenWa().description;

test('Message List exposes the complete pinned server query contract', () => {
  const options = properties.find((p) => p.name === 'messageListOptions').options;
  assert.deepEqual(options.map((p) => p.name).sort(), snapshot.contract.messageListQueries);
});

test('only the twelve idempotent sends offer an Idempotency Key', () => {
  const field = properties.find((p) => p.name === 'idempotencyKey');
  assert.deepEqual([...field.displayOptions.show.operation].sort(), [
    'forward',
    'reply',
    'sendAudio',
    'sendContact',
    'sendDocument',
    'sendImage',
    'sendLocation',
    'sendPoll',
    'sendSticker',
    'sendTemplate',
    'sendText',
    'sendVideo',
  ]);
  assert.equal(field.default, '');
});

test('Redrive Delivery Failures exposes only the server selection fields and does not require a session', () => {
  const options = properties.find((p) => p.name === 'redriveOptions').options;
  assert.deepEqual(options.map((p) => p.name).sort(), ['ids', 'limit', 'sessionId', 'webhookId']);
  const session = properties.find(
    (p) => p.name === 'sessionId' && p.displayOptions?.show?.resource?.includes('webhook'),
  );
  assert(session.displayOptions.hide.operation.includes('redriveDeliveryFailures'));
});

function upstreamSources() {
  const { contract } = snapshot;
  return {
    'src/modules/webhook/dto/webhook.dto.ts': `
      export const WEBHOOK_RESERVED_EVENTS = [] as const;
      export const WEBHOOK_EVENTS = ${JSON.stringify(contract.webhookEvents)} as const;
      export class RedriveWebhookDeliveriesDto {
        @IsOptional() @IsString() @MaxLength(128) sessionId?: string;
        @IsOptional() @IsString() @MaxLength(128) webhookId?: string;
        @IsOptional() @IsArray() @ArrayMaxSize(500) @IsString({each: true}) @MaxLength(128, {each: true}) ids?: string[];
        @IsOptional() @IsInt() @Min(1) @Max(500) limit?: number;
      }`,
    'src/modules/message/message.controller.ts': `
      @Controller('sessions/:sessionId/messages')
      export class MessageController {
        @Get() getMessages(${contract.messageListQueries.map((q, i) => `@Query('${q}') q${i}?: string`).join(',')}) {}
        ${contract.idempotentSendPaths.map((p, i) => `@Post('${p}') @IdempotentSend() send${i}() {}`).join('\n')}
      }`,
    'src/modules/webhook/webhooks-list.controller.ts': `
      @Controller('webhooks')
      export class WebhooksListController {
        @Post('delivery-failures/redrive') @RequireRole(ApiKeyRole.ADMIN) redriveDeliveryFailures(@Body() dto: RedriveWebhookDeliveriesDto) {}
      }`,
  };
}

function checkContract(t, change) {
  const dir = mkdtempSync(join(tmpdir(), 'openwa-contract-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const files = upstreamSources();
  change?.(files);
  for (const [name, source] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), source);
  }
  return spawnSync(process.execPath, ['scripts/check-openwa-contract.mjs', dir], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  });
}

test('the contract checker accepts a complete source contract', (t) => {
  const result = checkContract(t);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /0\.25\.0/);
});

for (const [label, file, before, after] of [
  ['event catalog', 'src/modules/webhook/dto/webhook.dto.ts', '"event.response",', ''],
  [
    'message filters',
    'src/modules/message/message.controller.ts',
    "@Query('since')",
    "@Query('other')",
  ],
  [
    'idempotent send',
    'src/modules/message/message.controller.ts',
    "@Post('reply') @IdempotentSend()",
    "@Post('reply')",
  ],
  [
    'redrive permission',
    'src/modules/webhook/webhooks-list.controller.ts',
    'ApiKeyRole.ADMIN',
    'ApiKeyRole.OPERATOR',
  ],
  ['redrive limit', 'src/modules/webhook/dto/webhook.dto.ts', '@Max(500)', '@Max(501)'],
  [
    'message route prefix',
    'src/modules/message/message.controller.ts',
    "@Controller('sessions/:sessionId/messages')",
    "@Controller('other')",
  ],
  [
    'webhook route prefix',
    'src/modules/webhook/webhooks-list.controller.ts',
    "@Controller('webhooks')",
    "@Controller('other')",
  ],
  ['redrive array type', 'src/modules/webhook/dto/webhook.dto.ts', '@IsArray()', ''],
  ['redrive integer type', 'src/modules/webhook/dto/webhook.dto.ts', '@IsInt()', ''],
  ['redrive string type', 'src/modules/webhook/dto/webhook.dto.ts', '@IsString()', ''],
  ['redrive optional field', 'src/modules/webhook/dto/webhook.dto.ts', '@IsOptional()', ''],
  [
    'redrive ID item type',
    'src/modules/webhook/dto/webhook.dto.ts',
    '@IsString({each: true})',
    '@IsString()',
  ],
  [
    'redrive ID item length',
    'src/modules/webhook/dto/webhook.dto.ts',
    '@MaxLength(128, {each: true})',
    '@MaxLength(128)',
  ],
  [
    'redrive body validation',
    'src/modules/webhook/webhooks-list.controller.ts',
    '@Body() dto: RedriveWebhookDeliveriesDto',
    '@Body() dto: unknown',
  ],
]) {
  test(`the contract checker rejects a changed ${label}`, (t) => {
    const result = checkContract(t, (files) => {
      files[file] = files[file].replace(before, after);
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /contract differs/);
  });
}
