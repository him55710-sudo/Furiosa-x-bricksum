import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { inspect, acknowledge } from '../scripts/council-snapshot.mjs';

async function fixture(t) {
  const parent = resolve(tmpdir());
  const root = await mkdtemp(join(parent, 'control-memory-council-'));
  t.after(async () => {
    assert.equal(dirname(resolve(root)), parent);
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

test('review remains pending until explicit acknowledgment; unchanged input stays quiet', async t => {
  const root = await fixture(t);
  await writeFile(join(root, 'README.md'), 'version one');
  const first = await inspect(root);
  assert.equal(first.status, 'REVIEW_REQUIRED');
  assert.equal((await inspect(root)).status, 'REVIEW_REQUIRED');
  await acknowledge(root, first.fingerprint);
  assert.equal((await inspect(root)).status, 'UNCHANGED');
});

test('detects edits, new implementation files, and deletion', async t => {
  const root = await fixture(t);
  await writeFile(join(root, 'README.md'), 'one');
  await acknowledge(root, (await inspect(root)).fingerprint);
  await writeFile(join(root, 'README.md'), 'two');
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'src', 'policy.ts'), 'export const cap = 30;');
  const changed = await inspect(root);
  assert.deepEqual(changed.changes.modified, ['README.md']);
  assert.deepEqual(changed.changes.added, ['src/policy.ts']);
  await acknowledge(root, changed.fingerprint);
  await rm(join(root, 'src', 'policy.ts'));
  assert.deepEqual((await inspect(root)).changes.removed, ['src/policy.ts']);
});

test('rejects stale acknowledgment when another session changes the input', async t => {
  const root = await fixture(t);
  await writeFile(join(root, 'README.md'), 'one');
  const old = await inspect(root);
  await writeFile(join(root, 'README.md'), 'two');
  await assert.rejects(acknowledge(root, old.fingerprint), /INPUT_CHANGED/);
  assert.equal((await inspect(root)).status, 'REVIEW_REQUIRED');
});

test('private files and council-generated artifacts do not cause feedback loops', async t => {
  const root = await fixture(t);
  await writeFile(join(root, 'README.md'), 'one');
  const initial = await inspect(root);
  await acknowledge(root, initial.fingerprint);
  await mkdir(join(root, 'docs', 'private'), { recursive: true });
  await writeFile(join(root, '.env.local'), 'TEST_SECRET=not-real');
  await writeFile(join(root, 'docs', 'private', 'secret.json'), '{}');
  await writeFile(join(root, 'docs', 'HACKATHON-PLAN.ko.md'), 'updated review plan');
  await writeFile(join(root, 'review', 'council', 'ROUND-002.ko.md'), 'updated review');
  const result = await inspect(root);
  assert.equal(result.status, 'UNCHANGED');
  assert.deepEqual(result.sources.map(x => x.path), ['README.md']);
});
