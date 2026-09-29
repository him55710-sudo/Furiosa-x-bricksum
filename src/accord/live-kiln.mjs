import {createHash} from 'node:crypto';
const need=(ok,code)=>{if(!ok)throw Error(code);};
export class LiveKilnClient {
 constructor({model=process.env.KILN_MODEL,key=process.env.KILN_API_KEY,onRecord=()=>{},fetchImpl=fetch}={}){need(model==='qwen3-32b','KILN_MODEL_REQUIRED');need(key,'KILN_API_KEY_REQUIRED');Object.assign(this,{model,key,onRecord,fetchImpl});}
 payload(system,input,tools){return {model:this.model,max_tokens:2400,stream:false,tool_choice:'auto',messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(input)}],tools:tools.map(spec=>({type:'function',function:spec}))};}
 async request(flow,payload,validate){
  need(payload.tools.length===1&&payload.tools[0].function.name==='send_negotiation_message','KILN_TOOL_NOT_ALLOWED');
  const start=Date.now();let body,result='KILN_NETWORK_ERROR',tool=null;
  try{
   const response=await this.fetchImpl('https://api.bricksum.com/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+this.key,'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(90000)});
   need(response.ok,'KILN_HTTP_'+response.status);need(response.body,'KILN_EMPTY_RESPONSE');
   const reader=response.body.getReader(),chunks=[];let size=0;
   try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;need(size<=2000000,'KILN_RESPONSE_TOO_LARGE');chunks.push(r.value);}}
   finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   body=JSON.parse(Buffer.concat(chunks).toString('utf8'));need(body.model===this.model,'KILN_MODEL_MISMATCH');need(typeof body.id==='string'&&body.id.length>0&&body.id.length<200,'KILN_REQUEST_ID_MISSING');
   const choice=body.choices?.[0],calls=choice?.message?.tool_calls;need(choice?.finish_reason!=='length','KILN_OUTPUT_TRUNCATED');
   need(calls?.length===1&&calls[0].type==='function'&&calls[0].function.name==='send_negotiation_message','KILN_INVALID_TOOL');
   tool=calls[0].function.name;const args=JSON.parse(calls[0].function.arguments);validate(tool,args);result='VALID_TOOL_PROPOSAL';return {tool,args,model:body.model,request_id:body.id};
  }catch(error){result=/^[A-Z0-9_]{3,100}$/.test(error.message)?error.message:'KILN_INVALID_RESPONSE';throw Error(result);}
  finally{this.onRecord({flow_name:flow,model:this.model,request_id:body?.id??null,prompt_tokens:body?.usage?.prompt_tokens??null,completion_tokens:body?.usage?.completion_tokens??null,total_tokens:body?.usage?.total_tokens??null,start_time:new Date(start).toISOString(),end_time:new Date().toISOString(),latency_ms:Date.now()-start,tool_called:tool,result,prompt_hash:createHash('sha256').update(JSON.stringify(payload)).digest('hex')});}
 }
}
