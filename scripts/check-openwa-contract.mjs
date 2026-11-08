import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';

const snapshot = JSON.parse(
  await readFile(new URL('../test/fixtures/openwa-0.29.1.json', import.meta.url), 'utf8'),
);
const paths = [
  'src/modules/webhook/dto/webhook.dto.ts',
  'src/modules/message/message.controller.ts',
  'src/modules/webhook/webhooks-list.controller.ts',
  'src/modules/group/group.controller.ts',
  'src/modules/group/dto/group.dto.ts',
  'src/modules/message/dto/send-message.dto.ts',
  'src/modules/search/search.controller.ts',
  'src/modules/search/dto/search-query.dto.ts',
  'src/modules/search/search.constants.ts',
  'src/modules/contact/contact.controller.ts',
  'src/modules/session/dto/recognised-session-config.validator.ts',
  'src/modules/message/dto/bulk-message.dto.ts',
  'src/modules/message/dto/message-responses.dto.ts',
];

function decorators(node) {
  return (ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : []).map((d) => {
    const expression = d.expression;
    return {
      name: expression.expression?.getText() ?? expression.getText(),
      args: expression.arguments?.map((a) => (ts.isStringLiteral(a) ? a.text : a.getText())) ?? [],
    };
  });
}

function declaration(source, name) {
  const node = source.statements.find((n) => ts.isClassDeclaration(n) && n.name?.text === name);
  assert(node, `Missing class ${name}`);
  return node;
}

function validationArgument(node, constants = {}) {
  if (ts.isIdentifier(node) && Object.hasOwn(constants, node.text)) return constants[node.text];
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (
    ts.isPropertyAccessExpression(node) &&
    node.name.text === 'length' &&
    ts.isIdentifier(node.expression) &&
    Array.isArray(constants[node.expression.text])
  ) {
    return constants[node.expression.text].length;
  }
  if (ts.isBinaryExpression(node)) {
    const left = validationArgument(node.left, constants);
    const right = validationArgument(node.right, constants);
    if (node.operatorToken.kind === ts.SyntaxKind.AsteriskToken) return left * right;
    if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) return left + right;
  }
  assert(ts.isObjectLiteralExpression(node), `Nonliteral validation argument ${node.getText()}`);
  return Object.fromEntries(
    node.properties.map((property) => {
      assert(ts.isPropertyAssignment(property), 'Nonliteral validation option');
      return [property.name.getText(), validationArgument(property.initializer, constants)];
    }),
  );
}

function initializer(source, name) {
  let expression = source.statements
    .filter(ts.isVariableStatement)
    .flatMap((s) => [...s.declarationList.declarations])
    .find((d) => d.name.getText() === name)?.initializer;
  while (expression && (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression))) {
    expression = expression.expression;
  }
  assert(expression, `Missing constant ${name}`);
  return expression;
}

function stringArray(source, name) {
  const expression = initializer(source, name);
  assert(expression && ts.isArrayLiteralExpression(expression), `Missing array ${name}`);
  return expression.elements.flatMap((element) => {
    if (ts.isSpreadElement(element)) return stringArray(source, element.expression.getText());
    assert(ts.isStringLiteral(element), `Nonliteral event in ${name}`);
    return [element.text];
  });
}

function dtoFields(source, name, constants = {}, selected, allowedValidators) {
  const validators = allowedValidators ?? [
    'IsOptional', 'IsString', 'IsArray', 'IsObject', 'IsInt', 'MaxLength', 'ArrayMinSize',
    'ArrayMaxSize', 'Min', 'Max', 'IsNotEmpty', 'IsIn', 'NoNulCharacter', 'Matches', 'IsMediaUrl',
  ];
  return Object.fromEntries(
    declaration(source, name).members.filter(ts.isPropertyDeclaration)
      .filter((field) => !selected || selected.includes(field.name.getText()))
      .map((field) => [field.name.getText(), Object.fromEntries(
        (ts.getDecorators(field) ?? []).map((d) => d.expression)
          .filter((d) => ts.isCallExpression(d) && validators.includes(d.expression.getText()))
          .map((d) => {
            const name = d.expression.getText();
            if (name === 'IsMediaUrl') return [name, []];
            if (name === 'Matches') {
              const regex = d.arguments[0];
              assert(ts.isNewExpression(regex) && regex.expression.getText() === 'RegExp', 'Missing label RegExp');
              const [pattern, flags] = regex.arguments ?? [];
              assert(pattern && ts.isTemplateExpression(pattern) && pattern.templateSpans.length === 1, 'Invalid label pattern');
              const span = pattern.templateSpans[0];
              assert(span.expression.getText() === 'GROUP_MEMBER_LABEL_MAX_LENGTH', 'Missing label cap');
              assert(!flags || ts.isStringLiteral(flags), 'Invalid label flags');
              return [name, [pattern.head.text + constants.GROUP_MEMBER_LABEL_MAX_LENGTH + span.literal.text, flags?.text ?? '']];
            }
            return [name, d.arguments.map((arg) => validationArgument(arg, constants))];
          }),
      )]),
  );
}

function optionalDtoTypes(source, name, selected) {
  const members = declaration(source, name).members.filter(ts.isPropertyDeclaration);
  return Object.fromEntries(
    [...selected].sort().map((fieldName) => {
      const field = members.find((m) => m.name.getText() === fieldName);
      assert(field && field.questionToken, `Missing optional field ${name}.${fieldName}`);
      assert(
        decorators(field).some((d) => d.name === 'ApiPropertyOptional'),
        `Missing ApiPropertyOptional on ${name}.${fieldName}`,
      );
      return [fieldName, field.type?.getText()];
    }),
  );
}

function route(source, className, methodName, parameterDecorator, dtoName) {
  const controller = declaration(source, className);
  const method = controller.members.find((m) => ts.isMethodDeclaration(m) && m.name.getText() === methodName);
  assert(method, `Missing method ${methodName}`);
  if (Array.isArray(parameterDecorator)) {
    const params = method.parameters.flatMap((p) =>
      decorators(p).filter((d) => d.name === 'Param').map((d) => d.args[0]),
    );
    assert.deepEqual(params, parameterDecorator, `Unexpected ${methodName} params`);
  } else {
    assert(method.parameters.some((p) => decorators(p).some((d) => d.name === parameterDecorator && d.args.length === 0) && p.type?.getText() === dtoName), `Missing ${methodName} validation`);
  }
  const metadata = decorators(method);
  const http = metadata.find((d) => ['Get', 'Post', 'Put', 'Patch', 'Delete'].includes(d.name));
  assert(http, `Missing ${methodName} route`);
  const result = {
    method: http.name.toUpperCase(),
    path: [decorators(controller).find((d) => d.name === 'Controller')?.args[0], ...http.args].join('/'),
  };
  const role = metadata.find((d) => d.name === 'RequireRole')?.args[0];
  if (role !== undefined || !Array.isArray(parameterDecorator)) result.role = role;
  const chatScoped = metadata.find((d) => d.name === 'ChatScoped')?.args[0];
  if (Array.isArray(parameterDecorator) && chatScoped !== undefined) result.chatScoped = chatScoped;
  return result;
}

try {
  const sources = await Promise.all(
    paths.map(async (path) => {
      let text;
      if (process.argv[2]) {
        text = await readFile(join(process.argv[2], path), 'utf8');
      } else {
        const url = `https://raw.githubusercontent.com/${snapshot.repository}/${snapshot.commit}/${path}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
        text = await response.text();
      }
      return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    }),
  );
  const [
    webhook,
    message,
    webhooksList,
    group,
    groupDto,
    sendDto,
    search,
    searchDto,
    searchConstants,
    contact,
    sessionConfigValidator,
    bulkDto,
    messageResponsesDto,
  ] = sources;
  const webhookEvents = stringArray(webhook, 'WEBHOOK_EVENTS').sort();
  const webhookEventValidators = ['IsArray', 'ArrayMinSize', 'ArrayMaxSize'];
  const createEventsBounds = dtoFields(
    webhook,
    'CreateWebhookDto',
    { WEBHOOK_EVENTS: webhookEvents },
    ['events'],
    webhookEventValidators,
  ).events;
  const updateEventsBounds = dtoFields(
    webhook,
    'UpdateWebhookDto',
    { WEBHOOK_EVENTS: webhookEvents },
    ['events'],
    webhookEventValidators,
  ).events;
  assert.deepEqual(
    createEventsBounds,
    updateEventsBounds,
    'CreateWebhookDto and UpdateWebhookDto events bounds differ',
  );
  const groupConstants = { GROUP_MEMBER_LABEL_MAX_LENGTH: validationArgument(initializer(groupDto, 'GROUP_MEMBER_LABEL_MAX_LENGTH')) };
  const previewConstants = Object.fromEntries(
    ['URL', 'TITLE', 'DESCRIPTION'].map((field) => {
      const name = `CUSTOM_PREVIEW_${field}_MAX_LENGTH`;
      return [name, validationArgument(initializer(sendDto, name))];
    }),
  );
  const preview = declaration(sendDto, 'SendTextMessageDto').members.find((m) => ts.isPropertyDeclaration(m) && m.name.getText() === 'customLinkPreview');
  assert(preview?.type?.getText() === 'CustomLinkPreviewDto', 'Missing custom link preview body');
  for (const name of ['IsOptional', 'IsObject', 'ValidateNested']) {
    assert(decorators(preview).some((d) => d.name === name), `Missing preview ${name}`);
  }
  const previewType = (ts.getDecorators(preview) ?? []).map((d) => d.expression)
    .find((d) => ts.isCallExpression(d) && d.expression.getText() === 'Type')?.arguments[0];
  assert(previewType && ts.isArrowFunction(previewType) && previewType.body.getText() === 'CustomLinkPreviewDto', 'Missing nested preview type');
  route(message, 'MessageController', 'sendText', 'Body', 'SendTextMessageDto');
  const messageController = declaration(message, 'MessageController');
  const webhookController = declaration(webhooksList, 'WebhooksListController');
  const messagePath = decorators(messageController).find((d) => d.name === 'Controller')?.args[0];
  const webhookPath = decorators(webhookController).find((d) => d.name === 'Controller')?.args[0];
  assert(messagePath && webhookPath, 'Missing controller prefix');
  const methods = messageController.members.filter(ts.isMethodDeclaration);
  const list = methods.find((m) =>
    decorators(m).some((d) => d.name === 'Get' && d.args.length === 0),
  );
  assert(list, 'Missing message listing route');
  const redrive = webhookController.members
    .filter(ts.isMethodDeclaration)
    .find((m) =>
      decorators(m).some((d) => d.name === 'Post' && d.args[0] === 'delivery-failures/redrive'),
    );
  assert(redrive, 'Missing redrive route');
  route(webhooksList, 'WebhooksListController', 'redriveDeliveryFailures', 'Body', 'RedriveWebhookDeliveriesDto');
  const redriveDecorators = decorators(redrive);
  const fields = dtoFields(webhook, 'RedriveWebhookDeliveriesDto');
  const actual = {
    webhookEvents,
    webhookEventsBounds: createEventsBounds,
    messageListPath: messagePath,
    messageListQueries: list.parameters
      .flatMap((p) =>
        decorators(p)
          .filter((d) => d.name === 'Query')
          .map((d) => d.args[0]),
      )
      .sort(),
    idempotentSendPaths: methods
      .filter((m) => decorators(m).some((d) => d.name === 'IdempotentSend'))
      .map((m) => decorators(m).find((d) => d.name === 'Post')?.args[0])
      .sort(),
    contactGetLid: route(contact, 'ContactController', 'getContactLid', ['sessionId', 'number']),
    messageGetReceipts: route(message, 'MessageController', 'getReceipts', [
      'sessionId',
      'chatId',
      'messageId',
    ]),
    chatHistoryForwardedFields: optionalDtoTypes(messageResponsesDto, 'ChatHistoryMessageDto', [
      'isForwarded',
      'forwardingScore',
    ]),
    maxSessionConfigBytes: validationArgument(
      initializer(sessionConfigValidator, 'MAX_SESSION_CONFIG_BYTES'),
    ),
    bulkMessages: dtoFields(
      bulkDto,
      'SendBulkMessageDto',
      { BULK_MESSAGES_MAX: validationArgument(initializer(bulkDto, 'BULK_MESSAGES_MAX')) },
      ['messages'],
    ).messages,
    redrive: {
      method: 'POST',
      path: `${webhookPath}/${redriveDecorators.find((d) => d.name === 'Post').args[0]}`,
      role: redriveDecorators.find((d) => d.name === 'RequireRole')?.args[0],
      fields,
    },
    groupMemberLabel: {
      ...route(group, 'GroupController', 'setMemberLabel', 'Body', 'GroupMemberLabelDto'),
      fields: dtoFields(groupDto, 'GroupMemberLabelDto', groupConstants),
    },
    customLinkPreview: dtoFields(sendDto, 'CustomLinkPreviewDto', previewConstants),
    search: {
      ...route(search, 'SearchController', 'search', 'Query', 'SearchQueryDto'),
      queries: declaration(searchDto, 'SearchQueryDto').members.filter(ts.isPropertyDeclaration).map((m) => m.name.getText()).sort(),
      fields: dtoFields(searchDto, 'SearchQueryDto', {
        SEARCH_QUERY_MAX_LENGTH: validationArgument(initializer(searchConstants, 'SEARCH_QUERY_MAX_LENGTH')),
        SEARCH_MATCH_MODES: stringArray(searchConstants, 'SEARCH_MATCH_MODES'),
      }, ['q', 'match']),
    },
  };
  assert.deepEqual(actual, snapshot.contract);
  console.log(`OpenWA ${snapshot.version} contract matches ${snapshot.commit}`);
} catch (error) {
  console.error('OpenWA contract differs from the pinned fixture or could not be verified.');
  console.error(error.message);
  process.exitCode = 1;
}
