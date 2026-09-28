import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectIdeas, mergeIdeaRecords } from '../scripts/council-ideas.mjs';
const id = 'allowed-source';
const page = text => ({ thread: { id, status: { type: 'idle' } }, turns: [{ id: 'turn-1', status: 'completed', error: null, items: [{ id: 'u1', type: 'userMessage', content: [{ type: 'text', text: 'idea' }] }, { id: 'a1', type: 'agentMessage', text }] }], page: { hasMore: false } });

test('detects new and edited messages, not identical rereads or ordering', () => {
  const first = inspectIdeas(page('first'), {}, id);
  assert.equal(first.changes.length, 2);
  const prior = { observedMessages: first.records };
  assert.equal(inspectIdeas(page('first'), prior, id).status, 'UNCHANGED');
  const edited = inspectIdeas(page('second'), prior, id);
  assert.equal(edited.changes.length, 1);
  assert.equal(edited.changes[0].reason, 'edited');
  const reversed = page('first'); reversed.turns[0].items.reverse();
  assert.equal(inspectIdeas(reversed, prior, id).fingerprint, first.fingerprint);
  assert.ok(first.records.every(r => !('text' in r)));
});

test('does not consume streaming, errored, truncated or wrong-source content', () => {
  const busy = page('first'); busy.thread.status.type = 'active';
  assert.equal(inspectIdeas(busy, {}, id).status, 'SOURCE_BUSY');
  const incomplete = page('first'); incomplete.turns[0].status = 'inProgress';
  assert.equal(inspectIdeas(incomplete, {}, id).records.length, 0);
  const failed = page('first'); failed.turns[0].error = { message: 'failed' };
  assert.equal(inspectIdeas(failed, {}, id).records.length, 0);
  const cut = page('first'); cut.turns[0].items[1].truncated = true;
  assert.equal(inspectIdeas(cut, {}, id).status, 'INCOMPLETE_SOURCE');
  assert.equal(inspectIdeas(page('x'.repeat(20000)), {}, id).status, 'INCOMPLETE_SOURCE');
  assert.throws(() => inspectIdeas(page('first'), {}, 'other'), /IDEA_SOURCE_MISMATCH/);
});

test('bounded pages retain prior records and expose older-page cursor', () => {
  const earlier = { messageId: 'old', sha256: 'old' };
  const latest = page('new'); latest.page = { hasMore: true, nextCursor: 'older-page' };
  const result = inspectIdeas(latest, { observedMessages: [earlier] }, id);
  assert.equal(result.nextCursor, 'older-page');
  assert.equal(mergeIdeaRecords([earlier], result.records).length, 3);
});
