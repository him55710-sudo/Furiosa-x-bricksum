import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {hash} from '../shared/schema.mjs';

export class Store {
  constructor(file='data/private/control-memory.sqlite') {
    if(file!==':memory:')mkdirSync(dirname(file),{recursive:true});
    this.db=new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS docs(kind TEXT NOT NULL,id TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(kind,id));
      CREATE TABLE IF NOT EXISTS events(session TEXT NOT NULL,seq INTEGER NOT NULL,body TEXT NOT NULL,PRIMARY KEY(session,seq));`);
  }
  get(kind,id){const r=this.db.prepare('SELECT body FROM docs WHERE kind=? AND id=?').get(kind,id);return r?JSON.parse(r.body):null;}
  all(kind){return this.db.prepare('SELECT body FROM docs WHERE kind=? ORDER BY rowid').all(kind).map(r=>JSON.parse(r.body));}
  put(kind,id,value){this.db.prepare('INSERT INTO docs VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body').run(kind,id,JSON.stringify(value));return value;}
  transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const r=fn();if(r?.then)throw new Error('ASYNC_SQL_TRANSACTION');this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  events(session){return this.db.prepare('SELECT body FROM events WHERE session=? ORDER BY seq').all(session).map(r=>JSON.parse(r.body));}
  event(session,type,data,runId=null){
    const prior=this.db.prepare('SELECT body FROM events WHERE session=? ORDER BY seq DESC LIMIT 1').get(session);
    const prev=prior?JSON.parse(prior.body):null;
    const body={sessionId:session,seq:(prev?.seq??0)+1,prevHash:prev?.hash??null,type,runId,at:new Date().toISOString(),data};
    const event={...body,hash:hash(body)};
    this.db.prepare('INSERT INTO events VALUES(?,?,?)').run(session,event.seq,JSON.stringify(event));return event;
  }
  close(){this.db.close();}
}
