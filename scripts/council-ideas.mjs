import { createHash } from 'node:crypto';

const digest = text => createHash('sha256').update(text).digest('hex');

// Receives read_thread data; never executes or persists conversation text.
export function inspectIdeas(page, previous = {}, expectedThreadId, maxChars = 20000) {
  if (page?.thread?.id !== expectedThreadId) throw new Error('IDEA_SOURCE_MISMATCH');
  if (page.thread.status?.type !== 'idle') return { status: 'SOURCE_BUSY', records: [], changes: [] };
  const records = [], changes = [];
  const known = new Map((previous.observedMessages ?? []).map(item => [item.messageId, item]));
  for (const turn of page.turns ?? []) {
    if (turn.status !== 'completed' || turn.error) continue;
    for (const item of turn.items ?? []) {
      if (!['userMessage', 'agentMessage'].includes(item.type)) continue;
      const parts = item.type === 'userMessage'
        ? (item.content ?? []).filter(c => c.type === 'text').map(c => c.text ?? '')
        : [item.text ?? ''];
      const text = parts.join('\n').replace(/\r\n?/g, '\n').normalize('NFC');
      if (!text.trim()) continue;
      if (!item.id || item.truncated || item.isTruncated || parts.some(p => p.length >= maxChars)) {
        return { status: 'INCOMPLETE_SOURCE', records: [], changes: [], turnId: turn.id };
      }
      const record = { messageId: item.id, turnId: turn.id, role: item.type === 'userMessage' ? 'user' : 'assistant', sha256: digest(item.type + '\n' + text) };
      records.push(record);
      const old = known.get(item.id);
      if (!old || old.sha256 !== record.sha256) changes.push({ ...record, reason: old ? 'edited' : 'new' });
    }
  }
  const sorted = [...records].sort((a, b) => a.messageId.localeCompare(b.messageId));
  return { status: changes.length ? 'IDEAS_CHANGED' : 'UNCHANGED', fingerprint: digest(JSON.stringify(sorted)), records, changes,
    hasMore: !!page.page?.hasMore, nextCursor: page.page?.nextCursor ?? null };
}

// Call only after semantic comparison is recorded. Keep older checkpoints when
// a bounded page no longer contains them; pagination is not a deletion event.
export function mergeIdeaRecords(previous = [], records = []) {
  const byId = new Map(previous.map(item => [item.messageId, item]));
  for (const item of records) byId.set(item.messageId, item);
  return [...byId.values()].sort((a, b) => a.messageId.localeCompare(b.messageId));
}
