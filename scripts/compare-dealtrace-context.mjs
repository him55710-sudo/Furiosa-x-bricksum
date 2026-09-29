// Research-only comparison. No wallets, server, settlement or automatic retry.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {ConversationModel,evidenceSpans,numericEvidence} from '../src/dealtrace/kiln.mjs';
import {expectedTerms} from '../src/dealtrace/ledger.mjs';
import {hash} from '../src/deal-escrow/domain.ts';
import {efficiency} from '../src/dealtrace/efficiency.mjs';

const live=process.argv.includes('--live');
if(!live&&!process.argv.includes('--rules-only'))throw new Error('Pass --live (uses Kiln) or --rules-only.');
const datasetPath='verification/dealtrace-context-comparison.json',datasetBytes=readFileSync(datasetPath),dataset=JSON.parse(datasetBytes);
const run=randomUUID(),dir=`artifacts/dealtrace/context-comparison/${run}`,usage=[],results=[],proposals=[];
const initial={...expectedTerms,price_minor:2600,deadline_seconds:300};
const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const sourceFiles=[datasetPath,'scripts/compare-dealtrace-context.mjs','src/dealtrace/kiln.mjs','src/deal-escrow/kiln.ts','src/dealtrace/ledger.mjs'];
const frozen={run,created_at:new Date().toISOString(),dataset_sha256:createHash('sha256').update(datasetBytes).digest('hex'),source_hashes:Object.fromEntries(sourceFiles.map(p=>[p,digest(p)])),initial_terms:initial,dataset,arms:live?['rules','incremental','full_transcript']:['rules']};
mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/frozen-input.json`,JSON.stringify(frozen,null,2)+'\n');
const limits=['Eight turns in two authored conversations, not held-out or external customer traffic.','Single attempt per turn and arm, no automatic retry; all malformed responses and consumed tokens remain counted.','Full-transcript arm sends the growing prefix but emits only the newest event patch. It does not request a complete transcript re-extraction. Both model arms use the same output schema and numeric/evidence validators.','Incremental arm receives the previous parsed state and newest message. Full-transcript arm receives initial terms and the full prefix, without previous parsed state.','Rules are explicit and tailored to these expressions; no claim of general language understanding or hardware energy reduction.'];
function save(status){const byArm=Object.fromEntries(frozen.arms.map(arm=>{const r=results.filter(x=>x.arm===arm),u=usage.filter(x=>x.arm===arm);return [arm,{turns:r.length,exact_state_and_provenance_passed:r.filter(x=>x.pass).length,exact_patch_passed:r.filter(x=>x.patch_pass).length,errors:r.filter(x=>x.error).length,false_acceptances:r.filter(x=>x.kind==='accept'&&x.expected_kind!=='accept').length,usage:efficiency(u)}];}));writeFileSync(`${dir}/report.json`,JSON.stringify({...frozen,status,results,proposals,usage,by_arm:byArm,limitations:limits},null,2)+'\n');}
save('RUNNING');
function rule(event){const text=event.content,patch=[];const add=(field,value,fragment)=>{const span=evidenceSpans(event).find(s=>s.text.includes(fragment));if(!span)throw new Error('RULE_EVIDENCE_MISSING');patch.push({field,value,quote:span.text});};
 if(text.includes('DEMO'))add('price_minor',numericEvidence('price_minor',text),'DEMO');
 if(/\d+ minutes?/.test(text))add('deadline_seconds',numericEvidence('deadline_seconds',text),'minutes');
 if(text.includes('annual CAPEX forecast')){add('metric','ANNUAL_CAPEX_FORECAST','annual CAPEX');add('periods',['2025'],'annual CAPEX');}
 if(text.includes('cannot include original'))add('source_required',false,'cannot include');
 if(text.includes('actual quarterly facility investment')){add('metric','ACTUAL_QUARTERLY_FACILITY_INVESTMENT','actual quarterly');add('periods',['2025-Q1','2025-Q2','2025-Q3','2025-Q4'],'actual quarterly');}
 if(text.includes('Original official source cells are included'))add('source_required',true,'Original official');
 return {kind:/I accept.*without any changes/.test(text)?'accept':'propose',patch};
}
for(const conversation of dataset.conversations){
 const events=conversation.events.map((e,i)=>({event_id:`${conversation.id}:${e.id}`,sequence:i+2,sender_agent:e.sender,content:e.text}));
 const states=Object.fromEntries(frozen.arms.map(arm=>[arm,{terms:structuredClone(initial),provenance:Object.fromEntries(Object.keys(initial).map(k=>[k,'initial']))}]));
 const models=Object.fromEntries(frozen.arms.filter(a=>a!=='rules').map(arm=>[arm,new ConversationModel(r=>{usage.push({...r,arm,conversation:conversation.id});save('RUNNING');},events.length,p=>proposals.push({...p,arm,conversation:conversation.id}))]));
 let expected=structuredClone(initial),expectedProvenance=Object.fromEntries(Object.keys(initial).map(k=>[k,'initial']));
 for(let i=0;i<events.length;i++){
  const event=events[i],c=conversation.events[i];expected={...expected,...c.patch};for(const field of Object.keys(c.patch))expectedProvenance[field]=event.event_id;
  // Alternate request order to avoid always giving one arm the first request.
  const arms=live?['rules',...(i%2?['full_transcript','incremental']:['incremental','full_transcript'])]:['rules'];
  for(const arm of arms){let output,error=null;const state=states[arm];
   try{if(arm==='rules')output=rule(event);else{const model=models[arm];
    if(arm==='full_transcript'){const original=model.request.bind(model);model.request=(flow,system,input,spec,check)=>{model.request=original;const full={initial_terms:initial,transcript:events.slice(0,i+1).map(e=>({event_id:e.event_id,sender:e.sender_agent,evidence_spans:evidenceSpans(e)})),event:input.event};return original(flow+' / full transcript',system+' Infer the current negotiation context from the entire supplied transcript and initial terms. Emit only the newest event patch. Do not copy earlier fields into that patch.',full,spec,check);};}
    output=(await model.extract([event],state.terms)).args.interpretations[0];
   }
   for(const p of output.patch){if(hash(state.terms[p.field])!==hash(p.value)){state.terms[p.field]=p.value;state.provenance[p.field]=event.event_id;}}
   }catch(e){error=e.message;}
   const delta=output?Object.fromEntries(output.patch.map(p=>[p.field,p.value])):null;
   const stopped=!!error||(output?.kind==='other'&&output.patch.length===0);
   const patchPass=c.must_stop?stopped:!error&&output.kind===c.kind&&hash(delta)===hash(c.patch);
   const statePass=hash(state.terms)===hash(expected)&&hash(state.provenance)===hash(expectedProvenance);
   const result={conversation:conversation.id,event_id:event.event_id,arm,kind:output?.kind??null,expected_kind:c.kind??'stop',output:output??null,error,patch_pass:patchPass,state_and_provenance_pass:statePass,pass:patchPass&&statePass,terms:structuredClone(state.terms),provenance:structuredClone(state.provenance),expected_terms:structuredClone(expected),expected_provenance:structuredClone(expectedProvenance)};
   results.push(result);save('RUNNING');console.log(JSON.stringify({event:event.event_id,arm,pass:result.pass,error}));
  }
 }
}
if(sourceFiles.some(p=>digest(p)!==frozen.source_hashes[p]))throw new Error('SOURCE_CHANGED_DURING_COMPARISON');
save('COMPLETE');console.log(JSON.stringify({run,report:`${dir}/report.json`}));
