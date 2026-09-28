import {createHash} from 'node:crypto';
import {MODEL} from '../shared/schema.mjs';
export const ENDPOINT='https://api.bricksum.com/v1/chat/completions';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const count=x=>Number.isSafeInteger(x)&&x>=0?x:null;

// SSE is framed by blank lines, not transport chunks. UTF-8 may also cross chunks.
export async function readCompletion(response,{started=performance.now(),clock=()=>performance.now(),maxBytes=2_000_000,onProgress=()=>{}}={}) {
  const decoder=new TextDecoder(),calls=new Map();let buffer='',bytes=0,done=false,finish=null,model=null,usage=null,id=null;
  let firstEventMs=null,firstTokenMs=null,firstToolMs=null,content='';
  const consume=frame=>{
    const data=frame.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
    if(!data)return;
    if(data==='[DONE]'){done=true;return;}
    if(done)throw new Error('DATA_AFTER_DONE');
    let value;try{value=JSON.parse(data);}catch{throw new Error('INVALID_SSE_JSON');}
    if(value.error)throw new Error('PROVIDER_STREAM_ERROR');
    const elapsed=Math.max(0,clock()-started);
    firstEventMs??=elapsed;
    if(value.model){if(model&&model!==value.model)throw new Error('MODEL_CHANGED_IN_STREAM');model=value.model;}
    id=value.id??id;usage=value.usage??usage;
    for(const choice of value.choices??[]){
      if(choice.index!==0)throw new Error('MULTIPLE_COMPLETIONS');
      if(choice.finish_reason)finish=choice.finish_reason;
      const d=choice.delta??{};
      if(d.content||d.reasoning_content||(d.tool_calls??[]).some(c=>c.function?.name||c.function?.arguments))firstTokenMs??=elapsed;
      if(d.content)content+=d.content;
      // Reasoning content is not persisted. Only its first nonempty arrival is timed.
      for(const c of d.tool_calls??[]){
        if(!Number.isSafeInteger(c.index)||c.index<0||c.index>16)throw new Error('INVALID_TOOL_INDEX');
        if(c.function?.name||c.function?.arguments)firstToolMs??=elapsed;
        const old=calls.get(c.index)??{id:'',type:'function',function:{name:'',arguments:''}};
        if(c.id){if(old.id&&old.id!==c.id)throw new Error('TOOL_ID_CHANGED');old.id=c.id;}
        if(c.type&&c.type!=='function')throw new Error('INVALID_TOOL_TYPE');
        old.function.name+=c.function?.name??'';old.function.arguments+=c.function?.arguments??'';calls.set(c.index,old);
      }
    }
    onProgress({firstEventMs,ttftMs:firstTokenMs,firstToolMs,model,usage,completionId:id,finishReason:finish});
  };
  if(!response.body)throw new Error('EMPTY_STREAM');
  for await(const chunk of response.body){
    bytes+=chunk.byteLength;if(bytes>maxBytes)throw new Error('STREAM_TOO_LARGE');
    buffer+=decoder.decode(chunk,{stream:true});buffer=buffer.replace(/\r\n/g,'\n');
    let boundary;while((boundary=buffer.indexOf('\n\n'))>=0){consume(buffer.slice(0,boundary));buffer=buffer.slice(boundary+2);}
  }
  buffer+=decoder.decode();if(buffer.trim())consume(buffer.replace(/\r\n/g,'\n'));
  if(!done||!finish)throw new Error('INCOMPLETE_STREAM');
  if(finish==='length')throw new Error('OUTPUT_TRUNCATED');
  if(!['stop','tool_calls'].includes(finish))throw new Error('UNSUPPORTED_FINISH_REASON');
  return {message:{role:'assistant',content:content||null,tool_calls:[...calls].sort(([a],[b])=>a-b).map(([,c])=>c)},model,usage,completionId:id,finishReason:finish,firstEventMs,ttftMs:firstTokenMs,firstToolMs};
}

export class KilnStream {
  constructor({key=process.env.KILN_API_KEY,fetchImpl=fetch,maxCalls=500,maxOutputTokens=1800,burst=3,windowMs=6000,maxRetries=2}={}){
    Object.assign(this,{key,fetchImpl,maxCalls,maxOutputTokens,burst,windowMs,maxRetries});this.calls=0;this.kind='LIVE_KILN';this.records=[];
    this.queue=Promise.resolve();this.windowEnd=0;this.remaining=burst;this.cooldownUntil=0;this.stopReason=null;
  }
  async schedule(){
    const ticket=this.queue.then(async()=>{
      const delay=Math.max(this.cooldownUntil, this.remaining===0?this.windowEnd:0)-Date.now();
      if(delay>0)await new Promise(r=>setTimeout(r,delay));
      if(Date.now()>=this.windowEnd){this.remaining=this.burst;this.windowEnd=Date.now()+this.windowMs;}
      this.remaining--;
    });this.queue=ticket.catch(()=>{});await ticket;
  }
  async beginBurst(){
    await this.queue;const delay=Math.max(this.windowEnd,this.cooldownUntil)-Date.now();if(delay>0)await new Promise(r=>setTimeout(r,delay));
  }
  async complete({messages,tools,flow,runId,maxTokens=this.maxOutputTokens}){
    for(let retry=0;;retry++){
      if(this.stopReason)throw new Error(this.stopReason);
      try{return await this.attempt({messages,tools,flow,runId,maxTokens,retry});}
      catch(e){
        if(e.message==='PROVIDER_QUOTA_EXHAUSTED'){this.stopReason=e.message;throw e;}
        if(!['HTTP_429','HTTP_503'].includes(e.message))throw e;
        if(retry>=this.maxRetries){this.stopReason='PROVIDER_CIRCUIT_OPEN';throw new Error(this.stopReason);}
      }
    }
  }
  async attempt({messages,tools,flow,runId,maxTokens,retry}){
    if(!this.key)throw new Error('MISSING_KILN_API_KEY');
    const queuedAt=performance.now();await this.schedule();
    if(this.stopReason)throw new Error(this.stopReason);
    if(this.calls>=this.maxCalls)throw new Error('GLOBAL_CALL_LIMIT');
    if(process.env.KILN_BASE_URL&&process.env.KILN_BASE_URL!=='https://api.bricksum.com/v1')throw new Error('UNEXPECTED_BASE_URL');
    if(process.env.KILN_MODEL&&process.env.KILN_MODEL!==MODEL)throw new Error('CHALLENGE_MODEL_REQUIRED');
    if(!Number.isSafeInteger(maxTokens)||maxTokens<1||maxTokens>this.maxOutputTokens)throw new Error('INVALID_OUTPUT_LIMIT');
    this.calls++;
    const payload={model:MODEL,messages,tools,tool_choice:'auto',stream:true,stream_options:{include_usage:true},max_tokens:maxTokens,temperature:0.7,top_p:0.8};
    const started=performance.now(),record={flow,runId,modelRequested:MODEL,requestHash:digest(payload),request:payload,httpStatus:null,generationId:null,modelReturned:null,promptTokens:null,completionTokens:null,totalTokens:null,costUsd:null,ttftMs:null,firstToolMs:null,firstEventMs:null,latencyMs:null,outcome:'PENDING',source:this.kind};
    record.retryIndex=retry;record.queueMs=performance.now()-queuedAt;this.records.push(record);
    let progress={};
    try{
      const response=await this.fetchImpl(ENDPOINT,{method:'POST',headers:{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(90000)});
      record.httpStatus=response.status;record.generationId=response.headers.get('x-neocloud-generation-id');
      if(!response.ok){
        const retryHeader=response.headers.get('retry-after');
        const seconds=retryHeader===null?null:Number(retryHeader);
        record.retryAfterMs=seconds!==null&&Number.isFinite(seconds)?Math.max(0,seconds*1000):retryHeader?Math.max(0,Date.parse(retryHeader)-Date.now()):null;
        let errorBody;try{errorBody=await response.json();}catch{}
        const code=errorBody?.error?.code;
        record.providerErrorCode=typeof code==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(code)?code:null;
        const diagnostic=[code,errorBody?.error?.type,errorBody?.error?.message].filter(x=>typeof x==='string').join(' ');
        if(/insufficient[_ ]quota|insufficient[_ ]credit|insufficient[_ ]balance|credit[s]? exhausted|잔액 부족/i.test(diagnostic))throw new Error('PROVIDER_QUOTA_EXHAUSTED');
        if([429,503].includes(response.status))this.cooldownUntil=Math.max(this.cooldownUntil,Date.now()+Math.max(record.retryAfterMs??0,60000*(retry+1)));
        throw new Error(`HTTP_${response.status}`);
      }
      if(!response.headers.get('content-type')?.includes('text/event-stream'))throw new Error('SSE_REQUIRED');
      const result=await readCompletion(response,{started,onProgress:p=>{progress=p;}});progress=result;
      if(result.model!==MODEL)throw new Error('MODEL_MISMATCH');
      record.outcome='COMPLETE';record.response=result.message;
      return {message:result.message,record};
    }catch(e){record.outcome=/^[A-Z][A-Z0-9_]+$/.test(e.message)?e.message:'NETWORK_OR_STREAM_ERROR';throw new Error(record.outcome);}
    finally{
      record.latencyMs=performance.now()-started;record.modelReturned=progress.model??null;record.completionId=progress.completionId??null;record.finishReason=progress.finishReason??null;
      for(const k of ['ttftMs','firstToolMs','firstEventMs'])record[k]=progress[k]??null;
      record.promptTokens=count(progress.usage?.prompt_tokens);record.completionTokens=count(progress.usage?.completion_tokens);record.totalTokens=count(progress.usage?.total_tokens);
      record.costUsd=typeof progress.usage?.cost==='number'&&Number.isFinite(progress.usage.cost)&&progress.usage.cost>=0?progress.usage.cost:null;
      record.outputTokensPerSecond=record.completionTokens!==null&&record.ttftMs!==null&&record.latencyMs>record.ttftMs?record.completionTokens/((record.latencyMs-record.ttftMs)/1000):null;
      record.throughputDefinition='Provider completion tokens divided by client stream duration after first content/reasoning/tool delta; approximate, not device throughput.';
    }
  }
}
