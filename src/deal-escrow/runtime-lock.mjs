import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,realpathSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import path from 'node:path';

// This is a single-writer coordinator, not a distributed worker lease. A live
// owner is never displaced by a timeout; only a provably dead PID is reclaimed.
export function acquireRuntimeLock(directory) {
  if (!directory) return {release() {}};
  mkdirSync(directory,{recursive:true});
  const root=realpathSync(directory),db=new DatabaseSync(path.join(root,'runtime-lock.sqlite'));
  db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS writer (id INTEGER PRIMARY KEY CHECK(id=1), pid INTEGER NOT NULL, token TEXT NOT NULL, acquired_at TEXT NOT NULL)');
  const token=randomUUID();let held=false;
  try {
    db.exec('BEGIN IMMEDIATE');
    const current=db.prepare('SELECT * FROM writer WHERE id=1').get();
    if(current){
      let dead=false;
      try{process.kill(Number(current.pid),0);}catch(error){if(error.code==='ESRCH')dead=true;}
      if(!dead)throw new Error('ADE_WRITER_ALREADY_RUNNING');
    }
    db.prepare('INSERT INTO writer VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET pid=excluded.pid,token=excluded.token,acquired_at=excluded.acquired_at').run(process.pid,token,new Date().toISOString());
    db.exec('COMMIT');held=true;
  }catch(error){try{db.exec('ROLLBACK');}catch{}db.close();throw error;}
  return {release(){if(!held)return;db.prepare('DELETE FROM writer WHERE id=1 AND pid=? AND token=?').run(process.pid,token);held=false;db.close();}};
}
