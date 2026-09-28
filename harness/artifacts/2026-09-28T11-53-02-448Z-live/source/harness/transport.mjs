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
  constructor({key=process.env.KILN_API_KEY,fetchImpl=fetch,maxCalls=500,maxOutputTokens=1800}={}){
    Object.assign(this,{key,fetchImpl,maxCalls,maxOutputTokens});this.calls=0;this.kind='LIVE_KILN';this.records=[];
  }
  async complete({messages,tools,flow,runId,maxTokens=this.maxOutputTokens}){
    if(!this.key)throw new Error('MISSING_KILN_API_KEY');
    if(this.calls>=this.maxCalls)throw new Error('GLOBAL_CALL_LIMIT');
    if(process.env.KILN_BASE_URL&&process.env.KILN_BASE_URL!=='https://api.bricksum.com/v1')throw new Error('UNEXPECTED_BASE_URL');
    if(process.env.KILN_MODEL&&process.env.KILN_MODEL!==MODEL)throw new Error('CHALLENGE_MODEL_REQUIRED');
    if(!Number.isSafeInteger(maxTokens)||maxTokens<1||maxTokens>this.maxOutputTokens)throw new Error('INVALID_OUTPUT_LIMIT');
    this.calls++;
    const payload={model:MODEL,messages,tools,tool_choice:'auto',stream:true,stream_options:{include_usage:true},max_tokens:maxTokens,temperature:0.7,top_p:0.8};
    const started=performance.now(),record={flow,runId,modelRequested:MODEL,requestHash:digest(payload),request:payload,httpStatus:null,generationId:null,modelReturned:null,promptTokens:null,completionTokens:null,totalTokens:null,costUsd:null,ttftMs:null,firstToolMs:null,firstEventMs:null,latencyMs:null,outcome:'PENDING',source:this.kind};
    this.records.push(record);
    let progress={};
    try{
      const response=await this.fetchImpl(ENDPOINT,{method:'POST',headers:{Authorization:`Bearer ${this.key}`,'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(90000)});
      record.httpStatus=response.status;record.generationId=response.headers.get('x-neocloud-generation-id');
      if(!response.ok)throw new Error(`HTTP_${response.status}`);
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
