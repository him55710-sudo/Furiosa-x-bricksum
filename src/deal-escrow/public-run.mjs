import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import path from 'node:path';

export const readJson=file=>JSON.parse(readFileSync(file,'utf8'));
export function saveJson(file,value){
  mkdirSync(path.dirname(file),{recursive:true});
  writeFileSync(`${file}.tmp`,JSON.stringify(value,null,2)+'\n',{mode:0o600});
  renameSync(`${file}.tmp`,file);
}

// A crash after sending inference may have consumed tokens. Never silently repeat
// it: a durable completed result is reusable; an ambiguous call needs review.
export async function onceInference(file,name,call){
  const journal=existsSync(file)?readJson(file):{};
  if(journal[name]?.state==='COMPLETE')return journal[name].result;
  if(journal[name])throw new Error(`INFERENCE_REQUIRES_REVIEW:${name}`);
  journal[name]={state:'STARTED',started_at:new Date().toISOString()};saveJson(file,journal);
  try{
    const result=await call();
    journal[name]={...journal[name],state:'COMPLETE',completed_at:new Date().toISOString(),result};saveJson(file,journal);
    return result;
  }catch(error){
    journal[name]={...journal[name],state:'INDETERMINATE',reason:'REQUEST_DID_NOT_COMPLETE'};saveJson(file,journal);throw error;
  }
}

export async function observeOperation(engine,id,kind,start,{timeoutMs=240000,pollMs=4000,onWait=()=>{}}={}){
  let initialError;
  if(start)try{await start();}catch(error){initialError=error.message;}
  const end=Date.now()+timeoutMs;
  while(Date.now()<end){
    const op=engine.store.operation(id,kind);
    if(op?.status==='CONFIRMED')return op;
    if(op?.status!=='PENDING')throw new Error(`OPERATION_STOPPED:${kind}:${op?.status??engine.store.get(id).state}:${initialError??''}`);
    onWait({id,kind,tx_hash:op.txHash??null});
    await new Promise(resolve=>setTimeout(resolve,pollMs));
    await engine.recover();
  }
  throw new Error(`OBSERVATION_TIMEOUT_RESUME_SAME_RUN:${id}:${kind}`);
}
