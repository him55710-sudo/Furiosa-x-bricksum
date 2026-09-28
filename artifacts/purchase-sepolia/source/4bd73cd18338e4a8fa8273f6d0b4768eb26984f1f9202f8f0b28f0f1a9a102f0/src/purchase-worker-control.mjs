import {fork} from 'node:child_process';
export class PurchaseWorker {
  constructor({directory,onEvent=()=>{}}){this.directory=directory;this.onEvent=onEvent;this.child=null;this.active=null;this.ready=false;this.generation=0;this.restarting=false;}
  snapshot(){return {pid:this.child?.pid??null,ready:this.ready,active:this.active,generation:this.generation,restarting:this.restarting};}
  async boot(){
    if(this.child)throw new Error('WORKER_ALREADY_RUNNING');
    this.ready=false;this.generation++;
    const child=fork(new URL('./purchase-worker.mjs',import.meta.url),[this.directory],{stdio:['ignore','ignore','pipe','ipc'],windowsHide:true});this.child=child;child.stderr.on('data',()=>{});
    child.on('message',m=>{if(m.type==='ready')this.ready=true;if(m.type==='done'){this.active=null;this.onEvent({type:'done',pid:child.pid,...m});}});
    child.on('exit',(code,signal)=>{if(this.child===child){this.child=null;this.ready=false;const purchaseId=this.active;this.active=null;this.onEvent({type:'exit',pid:child.pid,code,signal,purchaseId});}});
    await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{cleanup();reject(new Error('WORKER_START_TIMEOUT'));},15000);const onMessage=m=>{if(m.type==='ready'){cleanup();resolve();}};const onExit=()=>{cleanup();reject(new Error('WORKER_EXITED'));};const cleanup=()=>{clearTimeout(timeout);child.off('message',onMessage);child.off('exit',onExit);};child.on('message',onMessage);child.once('exit',onExit);});return this.snapshot();
  }
  run(purchaseId,scenario){if(!this.ready||!this.child||this.restarting)throw new Error('WORKER_NOT_READY');if(this.active)throw new Error('WORKER_BUSY');this.active=purchaseId;this.child.send({type:'run',purchaseId,scenario});return this.snapshot();}
  async close(){const child=this.child;if(!child)return;await new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGKILL');});}
  async restart(){if(this.restarting)throw new Error('WORKER_RESTARTING');this.restarting=true;const previous=this.snapshot();try{await this.close();await this.boot();return {previous,current:this.snapshot()};}finally{this.restarting=false;}}
}
