import {openSync,writeFileSync,fsyncSync,closeSync,renameSync,mkdirSync} from 'node:fs';
import path from 'node:path';

// Windows indexing/AV can temporarily hold the destination open. Retry the same
// atomic rename; never discard the old durable journal or broadcast before saving.
export function saveJson(file,value){
 mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp',fd=openSync(tmp,'w',0o600);
 try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}
 for(let attempt=0;;attempt++){try{renameSync(tmp,file);return;}catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt===12)throw error;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25*(attempt+1));}}
}
