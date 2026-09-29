export function browserStore(indexedDB=globalThis.indexedDB){
 if(!indexedDB)throw Error('Browser storage is unavailable. Use a normal browser window with site storage enabled.');
 let opening;
 const open=()=>opening??=new Promise((resolve,reject)=>{const r=indexedDB.open('accord-lock-workspace-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 return {
  async load(){const db=await open();return new Promise((resolve,reject)=>{const r=db.transaction('workspace').objectStore('workspace').get('state');r.onsuccess=()=>resolve(r.result??{version:1,jobs:[],operations:{},chain:null});r.onerror=()=>reject(r.error);});},
  async save(state){const db=await open();return new Promise((resolve,reject)=>{const t=db.transaction('workspace','readwrite');t.objectStore('workspace').put(state,'state');t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error??Error('Storage update was interrupted.'));});},
  async close(){if(opening)(await opening).close();}
 };
}
