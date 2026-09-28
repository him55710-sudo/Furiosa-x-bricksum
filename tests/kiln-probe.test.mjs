import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const scriptUrl = new URL('../scripts/kiln-probe.mjs', import.meta.url).href;
const valid = {
  id: 'offline-fixture', model: 'qwen3-32b',
  usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
  choices: [{ finish_reason: 'tool_calls', message: { tool_calls: [{
    type: 'function', function: { name: 'propose_purchase', arguments: JSON.stringify({ offer_id: 'beta-plus', reason: 'fixture' }) },
  }] } }],
};

async function probe({ listed = true, response = valid, http = 200, route = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'gwdc-kiln-probe-test-'));
  try {
    // Stub every network request in a child process. No real credentials/network.
    const child = spawnSync(process.execPath, ['--input-type=module', '--eval', `
      process.env.KILN_API_KEY = 'offline-fixture-only';
      process.env.KILN_BASE_URL = 'https://api.bricksum.com/v1';
      process.env.KILN_MODEL = 'qwen3-32b';
      ${route ? "process.argv.push('--verify-route');" : ''}
      globalThis.fetch = async (url, options) => {
        if (url === 'https://api.bricksum.com/v1/models') return new Response(JSON.stringify({data:${JSON.stringify(listed ? [{ id: 'qwen3-32b' }] : [])}}), {status:200});
        if (url !== 'https://api.bricksum.com/v1/chat/completions') throw new Error('UNEXPECTED_NETWORK_TARGET');
        if (JSON.parse(options.body).model !== 'qwen3-32b') throw new Error('UNEXPECTED_MODEL');
        return new Response(${JSON.stringify(JSON.stringify(response))}, {status:${http}});
      };
      await import(${JSON.stringify(scriptUrl)});
    `], { cwd: dir, encoding: 'utf8' });
    const files = await readdir(join(dir, 'artifacts/kiln'));
    assert.equal(files.length, 1);
    const raw = await readFile(join(dir, 'artifacts/kiln', files[0]), 'utf8');
    assert.equal(raw.includes('offline-fixture-only'), false, 'credential must not be saved');
    return { report: JSON.parse(raw), exit: child.status };
  } finally {
    // Delete only the specific temporary test directory just created.
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert.ok(dir.split(/[\\/]/).at(-1).startsWith('gwdc-kiln-probe-test-'));
    await rm(dir, { recursive: true, force: true });
  }
}

test('valid proposal preserves usage and never claims payment', async () => {
  const { report, exit } = await probe();
  assert.equal(exit, 0);
  assert.equal(report.status, 'LIVE_KILN_PROPOSAL_VALIDATED_NO_PAYMENT');
  assert.equal(report.selected_offer_id, 'beta-plus');
  assert.equal(report.validated_tool_proposal.tool_name, 'propose_purchase');
  assert.equal(report.usage_complete, true);
  assert.deepEqual(report.onchain_transactions, []);
});

test('missing catalog model stops before inference', async () => {
  const { report, exit } = await probe({ listed: false });
  assert.equal(exit, 1);
  assert.equal(report.reason_code, 'REQUIRED_MODEL_NOT_SERVED');
  assert.equal(report.inference_calls.length, 0);
});

test('explicit route diagnostic records 404 without inventing zero usage', async () => {
  const { report } = await probe({ listed: false, route: true, http: 404, response: { error: { code: 'model_not_found', message: 'offline-fixture-only' } } });
  assert.equal(report.reason_code, 'INFERENCE_HTTP_404');
  assert.equal(report.inference_calls.length, 1);
  assert.equal(report.inference_calls[0].total_tokens, null);
  assert.equal(report.inference_calls[0].provider_error.classification, 'MODEL_NOT_FOUND_OR_INACCESSIBLE');
});

test('unclassified 404 is not mislabeled and raw error fields are omitted', async () => {
  const { report } = await probe({ http: 404, response: { error: { code: 'offline-fixture-only', message: 'offline-fixture-only' } } });
  assert.deepEqual(report.inference_calls[0].provider_error, { code: null, classification: 'UNCLASSIFIED_HTTP_ERROR' });
});

test('provider model substitution is rejected', async () => {
  const { report } = await probe({ response: { ...valid, model: 'other-model' } });
  assert.equal(report.reason_code, 'MODEL_ID_MISMATCH');
});

test('truncation does not authorize a partial proposal', async () => {
  const response = structuredClone(valid);
  response.choices[0].finish_reason = 'length';
  const { report } = await probe({ response });
  assert.equal(report.reason_code, 'OUTPUT_TRUNCATED');
});

test('unknown or filtered offer cannot be selected', async () => {
  const response = structuredClone(valid);
  response.choices[0].message.tool_calls[0].function.arguments = JSON.stringify({ offer_id: 'alpha-over-cap', reason: 'fixture' });
  const { report } = await probe({ response });
  assert.equal(report.reason_code, 'UNKNOWN_OR_INELIGIBLE_OFFER');
});

test('multiple proposed calls are rejected', async () => {
  const response = structuredClone(valid);
  response.choices[0].message.tool_calls.push(response.choices[0].message.tool_calls[0]);
  const { report } = await probe({ response });
  assert.equal(report.reason_code, 'VALID_PROPOSAL_TOOL_REQUIRED');
});
