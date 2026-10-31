import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { OpenWa } from '../dist/nodes/OpenWa/OpenWa.node.js';

const snapshot = JSON.parse(
  readFileSync(new URL('./fixtures/openwa-0.27.0.json', import.meta.url)),
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

test('OpenWA 0.27.0 group member label, custom link preview thumbnails, and search match mode are exposed', () => {
  const groupOp = properties.find(
    (p) => p.name === 'operation' && p.displayOptions?.show?.resource?.includes('group'),
  );
  assert(groupOp.options.some((o) => o.value === 'setMemberLabel'));
  const groupId = properties.find((p) => p.name === 'groupId');
  assert(groupId.displayOptions.show.operation.includes('setMemberLabel'));
  const memberLabel = properties.find((p) => p.name === 'groupMemberLabel');
  assert.deepEqual(memberLabel.displayOptions.show, {
    resource: ['group'],
    operation: ['setMemberLabel'],
  });

  const previewOpts = properties.find((p) => p.name === 'customLinkPreview').options;
  assert.deepEqual(previewOpts.map((p) => p.name).sort(), [
    'previewDescription',
    'previewTitle',
    'previewUrl',
    'thumbnailBase64',
    'thumbnailUrl',
  ]);

  const searchOpts = properties.find((p) => p.name === 'searchFilters').options;
  const matchOpt = searchOpts.find((p) => p.name === 'match');
  assert.ok(matchOpt);
  assert.deepEqual(
    matchOpt.options.map((o) => o.value),
    ['contains', 'word'],
  );
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
        ${contract.idempotentSendPaths.map((p, i) => {
          const method = p === 'send-text' ? 'sendText' : `send${i}`;
          const parameter = p === 'send-text' ? '@Body() dto: SendTextMessageDto' : '';
          return `@Post('${p}') @IdempotentSend() ${method}(${parameter}) {}`;
        }).join('\n')}
      }`,
    'src/modules/webhook/webhooks-list.controller.ts': `
      @Controller('webhooks')
      export class WebhooksListController {
        @Post('delivery-failures/redrive') @RequireRole(ApiKeyRole.ADMIN) redriveDeliveryFailures(@Body() dto: RedriveWebhookDeliveriesDto) {}
      }`,
    'src/modules/group/group.controller.ts': `
      @Controller('sessions/:sessionId/groups')
      export class GroupController {
        @Put(':groupId/member-label') @RequireRole(ApiKeyRole.OPERATOR)
        setMemberLabel(@Body() dto: GroupMemberLabelDto) {}
      }`,
    'src/modules/group/dto/group.dto.ts': `
      export const GROUP_MEMBER_LABEL_MAX_LENGTH = 30;
      export class GroupMemberLabelDto {
        @ToStrictString() @IsString()
        @Matches(new RegExp(\`^[\\\\s\\\\S]{0,\${GROUP_MEMBER_LABEL_MAX_LENGTH}}$\`), { message: 'Label is too long' })
        label!: string;
      }`,
    'src/modules/message/dto/send-message.dto.ts': `
      export const CUSTOM_PREVIEW_URL_MAX_LENGTH = 2048;
      export const CUSTOM_PREVIEW_TITLE_MAX_LENGTH = 256;
      export const CUSTOM_PREVIEW_DESCRIPTION_MAX_LENGTH = 1024;
      export class CustomLinkPreviewDto {
        @ToStrictString() @IsString() @IsNotEmpty() @MaxLength(CUSTOM_PREVIEW_URL_MAX_LENGTH) url!: string;
        @ToStrictString() @IsString() @IsNotEmpty() @MaxLength(CUSTOM_PREVIEW_TITLE_MAX_LENGTH) title!: string;
        @IsOptional() @ToStrictString() @IsString() @MaxLength(CUSTOM_PREVIEW_DESCRIPTION_MAX_LENGTH) description?: string;
        @IsOptional() @IsMediaUrl<CustomLinkPreviewDto>({ignoreWhen: o => !!stripBase64DataUri(o.thumbnailBase64)}) thumbnailUrl?: string;
        @IsOptional() @ToStrictString() @IsString() thumbnailBase64?: string;
      }
      export class SendTextMessageDto {
        @IsOptional() @IsObject() @ValidateNested() @Type(() => CustomLinkPreviewDto)
        customLinkPreview?: CustomLinkPreviewDto;
      }`,
    'src/modules/search/search.controller.ts': `
      @Controller('search') export class SearchController {
        @Get() @RequireRole(ApiKeyRole.OPERATOR) search(@Query() dto: SearchQueryDto) {}
      }`,
    'src/modules/search/search.constants.ts': `
      export const SEARCH_QUERY_MAX_LENGTH = 1000;
      export const SEARCH_MATCH_MODES = ['word', 'contains'] as const satisfies readonly SearchMatch[];`,
    'src/modules/search/dto/search-query.dto.ts': `
      export class SearchQueryDto {
        @ToStrictString() @IsString() @IsNotEmpty() @MaxLength(SEARCH_QUERY_MAX_LENGTH) @NoNulCharacter() q!: string;
        @IsOptional() @IsIn(SEARCH_MATCH_MODES) match?: SearchMatch;
        sessionId?: string; chatId?: string; from?: string; direction?: MessageDirection;
        type?: MessageType; dateFrom?: number; dateTo?: number; limit?: number; offset?: number;
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
  assert.match(result.stdout, /0\.27\.0/);
});

for (const [label, file, before, after] of [
  ['member label method', 'src/modules/group/group.controller.ts', "@Put(':groupId/member-label')", "@Post(':groupId/member-label')"],
  ['member label path', 'src/modules/group/group.controller.ts', ':groupId/member-label', ':groupId/label'],
  ['member label permission', 'src/modules/group/group.controller.ts', 'ApiKeyRole.OPERATOR', 'ApiKeyRole.ADMIN'],
  ['member label body', 'src/modules/group/group.controller.ts', '@Body() dto: GroupMemberLabelDto', '@Body() dto: unknown'],
  ['member label body extraction', 'src/modules/group/group.controller.ts', '@Body() dto: GroupMemberLabelDto', "@Body('label') dto: GroupMemberLabelDto"],
  ['member label cap', 'src/modules/group/dto/group.dto.ts', 'MAX_LENGTH = 30', 'MAX_LENGTH = 31'],
  ['member label code units', 'src/modules/group/dto/group.dto.ts', '}}$`)', '}}$`, \'u\')'],
  ['preview thumbnail field', 'src/modules/message/dto/send-message.dto.ts', 'thumbnailBase64?: string;', ''],
  ['preview optional thumbnail', 'src/modules/message/dto/send-message.dto.ts', '@IsOptional() @ToStrictString() @IsString() thumbnailBase64', '@ToStrictString() @IsString() thumbnailBase64'],
  ['preview title length', 'src/modules/message/dto/send-message.dto.ts', 'TITLE_MAX_LENGTH = 256', 'TITLE_MAX_LENGTH = 257'],
  ['search modes', 'src/modules/search/search.constants.ts', "['word', 'contains']", "['word', 'prefix']"],
  ['search query limit', 'src/modules/search/search.constants.ts', 'MAX_LENGTH = 1000', 'MAX_LENGTH = 1001'],
  ['search NUL validation', 'src/modules/search/dto/search-query.dto.ts', '@NoNulCharacter()', ''],
  ['search query field', 'src/modules/search/dto/search-query.dto.ts', 'match?: SearchMatch;', ''],
  ['search query validation', 'src/modules/search/search.controller.ts', '@Query() dto: SearchQueryDto', '@Query() dto: unknown'],
  ['search query extraction', 'src/modules/search/search.controller.ts', '@Query() dto: SearchQueryDto', "@Query('q') dto: SearchQueryDto"],
  ['send text body extraction', 'src/modules/message/message.controller.ts', '@Body() dto: SendTextMessageDto', "@Body('payload') dto: SendTextMessageDto"],
  ['send text body validation', 'src/modules/message/message.controller.ts', '@Body() dto: SendTextMessageDto', '@Body() dto: unknown'],
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
  [
    'redrive body extraction',
    'src/modules/webhook/webhooks-list.controller.ts',
    '@Body() dto: RedriveWebhookDeliveriesDto',
    "@Body('ids') dto: RedriveWebhookDeliveriesDto",
  ],
]) {
  test(`the contract checker rejects a changed ${label}`, (t) => {
    const result = checkContract(t, (files) => {
      assert(files[file].includes(before), `Missing mutation target: ${label}`);
      files[file] = files[file].replace(before, after);
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /contract differs/);
  });
}
