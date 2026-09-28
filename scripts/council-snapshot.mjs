import { readFile, readdir, mkdir, writeFile, rename, lstat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const roots = ['docs', 'scripts', 'tests', 'src', 'app', 'components', 'contracts', 'fixtures', 'research', 'artifacts/kiln', 'artifacts/runs', 'artifacts/experiments'];
const fixed = ['README.md', 'package.json', 'package-lock.json', 'tsconfig.json', 'review/ROUND-1.ko.md', 'review/ROUND-2.ko.md', 'review/RESEARCH-TO-TESTS.ko.md'];
const extensions = new Set(['.md', '.json', '.mjs', '.cjs', '.js', '.ts', '.tsx', '.jsx', '.sol', '.sql', '.yaml', '.yml']);
const ownFiles = new Set(['docs/HACKATHON-PLAN.ko.md', 'scripts/council-snapshot.mjs', 'tests/council-snapshot.test.mjs']);
const ignoredDirs = new Set(['node_modules', 'private', 'vendor', 'dist', 'build', 'archive', 'coverage']);
const statePath = 'review/council/state.json';
const hash = value => createHash('sha256').update(value).digest('hex');

async function exists(path) {
  try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function collectSnapshot(root) {
  const paths = new Set();
  async function visit(relative) {
    const stat = await exists(join(root, relative));
    if (!stat || stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
        if (entry.name.startsWith('.') || ignoredDirs.has(entry.name) || entry.isSymbolicLink()) continue;
        await visit(`${relative}/${entry.name}`);
      }
    } else if (stat.isFile() && extensions.has(extname(relative)) && !ownFiles.has(relative)) paths.add(relative);
  }
  for (const path of [...fixed, ...roots]) await visit(path);
  const sources = [];
  for (const path of [...paths].sort()) {
    const data = await readFile(join(root, path));
    sources.push({ path, sha256: hash(data), bytes: data.length });
  }
  return { schemaVersion: 1, fingerprint: hash(JSON.stringify(sources)), sources };
}

export function compareSources(before = [], after = []) {
  const old = new Map(before.map(item => [item.path, item.sha256]));
  const current = new Map(after.map(item => [item.path, item.sha256]));
  return {
    added: after.filter(item => !old.has(item.path)).map(item => item.path),
    modified: after.filter(item => old.has(item.path) && old.get(item.path) !== item.sha256).map(item => item.path),
    removed: before.filter(item => !current.has(item.path)).map(item => item.path),
  };
}

export async function inspect(root) {
  const snapshot = await collectSnapshot(root);
  const stateFile = join(root, statePath);
  const state = await exists(stateFile) ? JSON.parse(await readFile(stateFile, 'utf8')) : {};
  return {
    status: snapshot.fingerprint === state.fingerprint ? 'UNCHANGED' : 'REVIEW_REQUIRED',
    ...snapshot,
    changes: compareSources(state.sources, snapshot.sources),
  };
}

export async function acknowledge(root, reviewedFingerprint) {
  const snapshot = await collectSnapshot(root);
  if (!/^[a-f0-9]{64}$/.test(reviewedFingerprint ?? '') || snapshot.fingerprint !== reviewedFingerprint) {
    throw new Error('INPUT_CHANGED: inspect and review the current fingerprint before acknowledging');
  }
  const output = join(root, statePath);
  await mkdir(dirname(output), { recursive: true });
  const temp = `${output}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify({ ...snapshot, reviewedAt: new Date().toISOString() }, null, 2) + '\n');
  await rename(temp, output);
  return { status: 'REVIEW_BASELINE_SAVED', fingerprint: snapshot.fingerprint, sources: snapshot.sources.length };
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const args = process.argv.slice(2);
    if (args.length && !(args.length === 2 && args[0] === '--ack')) throw new Error('Usage: node scripts/council-snapshot.mjs [--ack fingerprint]');
    const result = args.length ? await acknowledge(root, args[1]) : await inspect(root);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
