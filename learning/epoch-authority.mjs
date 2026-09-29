import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ensure, digest } from './model.mjs';

export const preferenceScope = c => ({ ownerId: c.ownerId, purpose: c.purpose, category: c.category, featureSchema: c.featureSchema });
const stamp = c => ({ id: c.preferenceEpochId ?? 'initial', sequence: c.preferenceEpochSequence ?? 0 });

// Independent active epoch pointer. Never restore this database from an untrusted model snapshot.
// This reference store records epoch transitions, not every feedback event or HTTP authorization.
export class EpochAuthority {
  #db;
  constructor(path) {
    ensure(typeof path === 'string' && path.length, 'EPOCH_DATABASE_PATH_REQUIRED');
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.#db = new DatabaseSync(path);
    this.#db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS active_epoch(scope TEXT PRIMARY KEY, epoch_id TEXT NOT NULL, sequence INTEGER NOT NULL, initial_snapshot TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS epoch_transitions(scope TEXT NOT NULL, sequence INTEGER NOT NULL, epoch_id TEXT NOT NULL, body TEXT NOT NULL,
        PRIMARY KEY(scope, sequence), UNIQUE(scope, epoch_id));`);
  }
  #transaction(fn) {
    this.#db.exec('BEGIN IMMEDIATE');
    try { const value = fn(); ensure(!value?.then, 'ASYNC_EPOCH_TRANSACTION'); this.#db.exec('COMMIT'); return value; }
    catch (error) { this.#db.exec('ROLLBACK'); throw error; }
  }
  enrollInitial(modelSnapshot) {
    const c = modelSnapshot.config, current = stamp(c);
    ensure(current.id === 'initial' && current.sequence === 0, 'ONLY_INITIAL_EPOCH_CAN_ENROLL');
    return this.#transaction(() => {
      const key = digest(preferenceScope(c));
      this.#db.prepare('INSERT OR IGNORE INTO active_epoch VALUES(?,?,?,?)').run(key, current.id, 0, JSON.stringify(modelSnapshot));
      this.assertCurrent(c);
      return this.current(c);
    });
  }
  current(config) {
    const row = this.#db.prepare('SELECT epoch_id,sequence FROM active_epoch WHERE scope=?').get(digest(preferenceScope(config)));
    ensure(row, 'EPOCH_NOT_ENROLLED');
    return { preferenceEpochId: row.epoch_id, preferenceEpochSequence: row.sequence };
  }
  assertCurrent(config) {
    const active = this.current(config), candidate = stamp(config);
    ensure(active.preferenceEpochId === candidate.id && active.preferenceEpochSequence === candidate.sequence, 'STALE_PREFERENCE_EPOCH');
    return active;
  }
  runCurrent(config, fn) { return this.#transaction(() => { this.assertCurrent(config); return fn(); }); }
  advance(previousConfig, nextSnapshot, transition) {
    return this.#transaction(() => {
      this.assertCurrent(previousConfig);
      const key = digest(preferenceScope(previousConfig)), next = stamp(nextSnapshot.config), prior = stamp(previousConfig);
      ensure(digest(preferenceScope(nextSnapshot.config)) === key && next.sequence === prior.sequence + 1 && next.id !== prior.id && next.id !== 'initial', 'INVALID_EPOCH_ADVANCE');
      this.#db.prepare('INSERT INTO epoch_transitions VALUES(?,?,?,?)').run(key, next.sequence, next.id, JSON.stringify(transition));
      this.#db.prepare('UPDATE active_epoch SET epoch_id=?,sequence=?,initial_snapshot=? WHERE scope=?').run(next.id, next.sequence, JSON.stringify(nextSnapshot), key);
      return this.current(nextSnapshot.config);
    });
  }
  currentInitialSnapshot(config) {
    const row = this.#db.prepare('SELECT initial_snapshot FROM active_epoch WHERE scope=?').get(digest(preferenceScope(config)));
    ensure(row, 'EPOCH_NOT_ENROLLED'); return JSON.parse(row.initial_snapshot);
  }
  close() { this.#db.close(); }
}
