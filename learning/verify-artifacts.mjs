import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PreferenceModel, digest } from './model.mjs';
const root = fileURLToPath(new URL('./', import.meta.url));
const json = async path => JSON.parse((await readFile(resolve(root, path), 'utf8')).replace(/^\uFEFF/, ''));
const sha = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const manifest = await json('source-manifest.json');
assert.equal(manifest.length, 10);
for (const source of manifest) {
  assert.equal(source.status, 'saved');
  const path = resolve(root, source.file);
  assert.equal(await sha(path), source.sha256, source.id);
  assert.equal((await stat(path)).size, source.bytes, source.id);
}
const demo = await json('artifacts/demo.json');
assert.equal(demo.label, 'OFFLINE_SYNTHETIC_DEMO_NO_PURCHASE');
assert.deepEqual(PreferenceModel.restore(demo.modelSnapshot).summary(), demo.after);
assert.equal(demo.verification.mandateUnchanged, true);
assert.equal(demo.decision.paymentAuthorized, false);
for (const [path, hash] of Object.entries(demo.sourceHashes)) assert.equal(await sha(resolve(root, path)), hash, `demo stale: ${path}`);
const simulation = await json('artifacts/simulation.json');
assert.equal(simulation.label, 'SYNTHETIC_ONLY_NOT_DEPLOYMENT_VALIDATION');
assert.equal(simulation.rows.length, 24 * simulation.protocol.scenarios.length * 3);
assert.equal(simulation.protocolVersion, 2);
assert.equal(simulation.explicitEpochReset.rows.length, 24 * 3 * 2);
assert.equal(simulation.activeNewSeeds.rows.length, 24 * 4 * 3);
assert.equal(new Set(simulation.rows.map(r => `${r.seed}:${r.scenario}:${r.method}`)).size, simulation.rows.length);
assert.equal(simulation.rows.every(r => r.seed >= 101 && r.seed <= 124 && Number.isFinite(r.logLoss) && Number.isFinite(r.meanRegret)), true);
for (const [path, hash] of Object.entries(simulation.sourceHashes)) assert.equal(await sha(resolve(root, path)), hash, `simulation stale: ${path}`);
let links = 0;
async function checkMarkdown(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await checkMarkdown(path);
    else if (entry.name.endsWith('.md')) {
      const text = await readFile(path, 'utf8');
      for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
        const target = match[1];
        if (/^(https?:|#)/.test(target)) continue;
        await stat(resolve(dirname(path), decodeURIComponent(target.split('#')[0])));
        links++;
      }
    }
  }
}
await checkMarkdown(root);
console.log(JSON.stringify({ sourceArchives: manifest.length, sourceBytes: manifest.reduce((s, x) => s + x.bytes, 0),
  localDocumentLinks: links, evaluationRows: simulation.rows.length, reconstructedModelHash: digest(demo.modelSnapshot), status: 'PASS' }, null, 2));
