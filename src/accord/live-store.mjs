import {get,put,BlobPreconditionFailedError} from '@vercel/blob';
import {DatabaseSync} from 'node:sqlite';

// Both adapters expose compare-and-swap. Never use process memory as authority.
export function blobLiveStore({token=process.env.BLOB_READ_WRITE_TOKEN,key='accord/live-ledger-v1.json'}={}){
 return {
  // Compression adds W/ to the response ETag; conditional writes expect the
  // same underlying object's strong ETag. The origin still checks it atomically.
  async read(){const r=await get(key,{access:'private',token,useCache:false});return r?{value:JSON.parse(await new Response(r.stream).text()),etag:r.blob.etag.replace(/^W\//,'')}:null;},
  async write(value,etag){try{await put(key,JSON.stringify(value),{access:'private',token,addRandomSuffix:false,contentType:'application/json',...(etag?{ifMatch:etag,allowOverwrite:true}:{allowOverwrite:false})});return true;}catch(error){if(error instanceof BlobPreconditionFailedError||/already exists/i.test(error.message))return false;throw error;}}
 };
}

export function sqliteLiveStore(filename){
 const db=new DatabaseSync(filename);db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS live_ledger (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, body TEXT NOT NULL)');
 return {
  async read(){const r=db.prepare('SELECT revision,body FROM live_ledger WHERE id=1').get();return r?{value:JSON.parse(r.body),etag:String(r.revision)}:null;},
  async write(value,etag){const result=etag?db.prepare('UPDATE live_ledger SET revision=revision+1,body=? WHERE id=1 AND revision=?').run(JSON.stringify(value),Number(etag)):db.prepare('INSERT OR IGNORE INTO live_ledger VALUES(1,1,?)').run(JSON.stringify(value));return result.changes===1;},
  close:()=>db.close()
 };
}
