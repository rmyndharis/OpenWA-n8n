import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

// Imports the compiled output, so run `npm run build` before this test.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

// Nothing else loads the package the way n8n does: from the paths in package.json, which
// are plain strings. A typo there, an entry dropped from index.ts, an icon that was
// renamed in the source but not in the node, or a credential that stopped authenticating
// all build and pass every other test.

const classNameOf = (file) => basename(file).replace(/\.(node|credentials)\.js$/, '');

function load(file) {
  const path = join(root, file);
  assert.ok(existsSync(path), `${file} is listed in package.json but was not built`);
  const exported = require(path)[classNameOf(file)];
  assert.equal(typeof exported, 'function', `${file} must export a class named ${classNameOf(file)}`);
  return new exported();
}

test('every node and credential listed in package.json loads and is exported by index', () => {
  const index = require(join(root, 'dist/index.js'));
  for (const file of [...manifest.n8n.nodes, ...manifest.n8n.credentials]) {
    load(file);
    assert.equal(typeof index[classNameOf(file)], 'function', `index must export ${classNameOf(file)}`);
  }
});

test('every node icon exists next to the compiled node', () => {
  for (const file of manifest.n8n.nodes) {
    const { icon } = load(file).description;
    assert.match(icon, /^file:/);
    assert.ok(existsSync(join(root, dirname(file), icon.slice('file:'.length))), `${icon} is missing`);
  }
});

test('the credential authenticates with X-API-Key and tests against an endpoint that checks the key', () => {
  const [credentialFile] = manifest.n8n.credentials;
  const credential = load(credentialFile);
  assert.deepEqual(Object.keys(credential.authenticate.properties.headers), ['X-API-Key']);
  assert.equal(credential.test.request.method, 'GET');
  // /api/health is public on the server and accepts any key, so a test against it can never fail.
  assert.equal(credential.test.request.url, '/api/sessions');
  for (const file of manifest.n8n.nodes) {
    const names = load(file).description.credentials.map((entry) => entry.name);
    assert.ok(names.includes(credential.name), `${file} must ask for the ${credential.name} credential`);
  }
});
