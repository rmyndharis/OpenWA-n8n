import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';

const snapshot = JSON.parse(
  await readFile(new URL('../test/fixtures/openwa-0.26.0.json', import.meta.url), 'utf8'),
);
const paths = [
  'src/modules/webhook/dto/webhook.dto.ts',
  'src/modules/message/message.controller.ts',
  'src/modules/webhook/webhooks-list.controller.ts',
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

function validationArgument(node) {
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  assert(ts.isObjectLiteralExpression(node), `Nonliteral validation argument ${node.getText()}`);
  return Object.fromEntries(
    node.properties.map((property) => {
      assert(ts.isPropertyAssignment(property), 'Nonliteral validation option');
      return [property.name.getText(), validationArgument(property.initializer)];
    }),
  );
}

function stringArray(source, name) {
  let expression = source.statements
    .filter(ts.isVariableStatement)
    .flatMap((s) => [...s.declarationList.declarations])
    .find((d) => d.name.getText() === name)?.initializer;
  while (expression && ts.isAsExpression(expression)) expression = expression.expression;
  assert(expression && ts.isArrayLiteralExpression(expression), `Missing array ${name}`);
  return expression.elements.flatMap((element) => {
    if (ts.isSpreadElement(element)) return stringArray(source, element.expression.getText());
    assert(ts.isStringLiteral(element), `Nonliteral event in ${name}`);
    return [element.text];
  });
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
  const [webhook, message, webhooksList] = sources;
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
  assert(
    redrive.parameters.some(
      (p) =>
        decorators(p).some((d) => d.name === 'Body') &&
        p.type?.getText() === 'RedriveWebhookDeliveriesDto',
    ),
    'Missing redrive body validation',
  );
  const redriveDecorators = decorators(redrive);
  const fields = Object.fromEntries(
    declaration(webhook, 'RedriveWebhookDeliveriesDto')
      .members.filter(ts.isPropertyDeclaration)
      .map((field) => [
        field.name.getText(),
        Object.fromEntries(
          (ts.getDecorators(field) ?? [])
            .map((d) => d.expression)
            .filter(
              (d) =>
                ts.isCallExpression(d) &&
                [
                  'IsOptional',
                  'IsString',
                  'IsArray',
                  'IsInt',
                  'MaxLength',
                  'ArrayMaxSize',
                  'Min',
                  'Max',
                ].includes(d.expression.getText()),
            )
            .map((d) => [d.expression.getText(), d.arguments.map(validationArgument)]),
        ),
      ]),
  );
  const actual = {
    webhookEvents: stringArray(webhook, 'WEBHOOK_EVENTS').sort(),
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
    redrive: {
      method: 'POST',
      path: `${webhookPath}/${redriveDecorators.find((d) => d.name === 'Post').args[0]}`,
      role: redriveDecorators.find((d) => d.name === 'RequireRole')?.args[0],
      fields,
    },
  };
  assert.deepEqual(actual, snapshot.contract);
  console.log(`OpenWA ${snapshot.version} contract matches ${snapshot.commit}`);
} catch (error) {
  console.error('OpenWA contract differs from the pinned fixture or could not be verified.');
  console.error(error.message);
  process.exitCode = 1;
}
