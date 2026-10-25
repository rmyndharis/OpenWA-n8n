import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

// Imports the compiled output, so run `npm run build` before this test.
import { OpenWa } from '../dist/nodes/OpenWa/OpenWa.node.js';
import { OpenWaTrigger } from '../dist/nodes/OpenWaTrigger/OpenWaTrigger.node.js';

/**
 * n8n does not store a parameter whose value equals its default, so a node saved in a
 * workflow only holds what the user changed. Changing a `default` here therefore
 * changes every saved node that relied on it, and so does dropping an option a saved
 * node may hold. The handlers' inline fallbacks never see the description, so no other
 * test notices.
 *
 * test/fixtures/description-defaults.json freezes, per top-level property and
 * (resource, operation) it is shown for, the default and the option values. The check
 * is one-way on purpose: a new property, a new option, a reworded label or a changed
 * description does not touch it. Collections are left out, because n8n does not fill the
 * defaults of a collection's children when it loads a node.
 *
 * To change a default deliberately (a breaking change; see the upgrade notes in the
 * changelog), edit the node and then run
 *   UPDATE_DEFAULTS=1 node --test test/descriptionDefaults.test.mjs
 * and commit the new fixture with it. Run the same command after adding properties to
 * freeze them for the next release.
 */
const FIXTURE = new URL('./fixtures/description-defaults.json', import.meta.url);
const SKIPPED_TYPES = new Set(['notice', 'collection', 'fixedCollection']);

function snapshot() {
  const entries = {};
  for (const [label, Node] of [
    ['openWa', OpenWa],
    ['openWaTrigger', OpenWaTrigger],
  ]) {
    for (const property of new Node().description.properties) {
      if (SKIPPED_TYPES.has(property.type)) continue;
      const show = property.displayOptions?.show ?? {};
      const entry = { default: property.default };
      if (Array.isArray(property.options)) {
        entry.options = property.options.map((option) => option.value);
      }
      for (const resource of show.resource ?? ['*']) {
        for (const operation of show.operation ?? ['*']) {
          const key = `${label}:${property.name}@${resource}/${operation}`;
          if (key in entries) {
            assert.deepEqual(entries[key], entry, `${key} is declared twice with different content`);
          }
          entries[key] = entry;
        }
      }
    }
  }
  return entries;
}

if (process.env.UPDATE_DEFAULTS) {
  const current = snapshot();
  const lines = Object.keys(current)
    .sort()
    .map((key) => `  ${JSON.stringify(key)}: ${JSON.stringify(current[key])}`);
  writeFileSync(FIXTURE, `{\n${lines.join(',\n')}\n}\n`);
}

const frozen = JSON.parse(readFileSync(FIXTURE, 'utf8'));
const current = snapshot();

test('the frozen defaults fixture is not empty or truncated', () => {
  assert.ok(Object.keys(frozen).length >= 100, 'expected the full property set');
});

test('no frozen default or option has changed or gone', () => {
  const problems = [];
  for (const [key, expected] of Object.entries(frozen)) {
    const actual = current[key];
    if (!actual) {
      problems.push(`${key}: gone, and a saved node may still carry it`);
      continue;
    }
    if (JSON.stringify(actual.default) !== JSON.stringify(expected.default)) {
      problems.push(
        `${key}: default ${JSON.stringify(expected.default)} became ${JSON.stringify(actual.default)}`,
      );
    }
    for (const value of expected.options ?? []) {
      if (!(actual.options ?? []).includes(value)) {
        problems.push(`${key}: option ${JSON.stringify(value)} was removed`);
      }
    }
  }
  assert.deepEqual(
    problems,
    [],
    'n8n does not save a value equal to its default, so changing one changes every saved node that relied on it. If this is deliberate, regenerate the fixture (see the header of this file) and call it out in the upgrade notes.',
  );
});
