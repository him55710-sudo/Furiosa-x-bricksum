import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {KilnClient} from '../src/deal-escrow/kiln.ts';
import {now} from '../src/deal-escrow/domain.ts';
import {resolveSelection} from '../src/deal-escrow/research.ts';
import {verificationSource} from '../src/deal-escrow/verification-source.mjs';

// One bounded regression of the production model adapter; no engine, wallet,
// mandate store or payment endpoint is opened by this probe.
const previous='artifacts/deal-escrow/source-workbench';
const original=JSON.parse(readFileSync(previous+'/report.json','utf8'));
const receipt=JSON.parse(readFileSync(previous+'/0a32c266-5cde-4ff1-831c-1bb5f5f636cb.json','utf8'));
const time=now(),input={human_task:original.research_requests[0].task,offers:original.research_requests[0].offers,mandate:{...receipt.mandate,mandate_id:'unit-regression-'+randomUUID(),status:'ACTIVE',created_at:time,expires_at:time+1800}};
const id=new Date().toISOString().replaceAll(':','-'),directory='artifacts/deal-escrow/unit-regression/'+id;
const plan={id,created_at:new Date().toISOString(),maximum_inference_calls:1,maximum_output_tokens:2400,payments:false,scope:'Known-case development regression with a synthetic mandate; not a newly approved purchase, model benchmark or energy measurement.',input,source_fingerprint:verificationSource().sha256};
if(!process.argv.includes('--live')){console.log(JSON.stringify({...plan,note:'Add --live for one actual Kiln request; no automatic retries.'},null,2));process.exit(0);}
mkdirSync(directory,{recursive:true});writeFileSync(directory+'/plan.json',JSON.stringify(plan,null,2)+'\n');
const records=[];let payload=null,result=null,selection=null,error=null,listing=null;
const client=new KilnClient({fetchImpl:async(url,options)=>{if(options?.body)payload=JSON.parse(options.body);return fetch(url,options);},onRecord:r=>records.push(r)});
try{listing=await client.models();result=await client.selectOffer(input);selection=resolveSelection(input.mandate,input.offers,result.args,now());}
catch(e){error=/^[A-Z0-9_]+$/.test(e.message)?e.message:'PROBE_FAILED';}
const report={...plan,completed_at:new Date().toISOString(),model_listing:{supported:listing?.supported??null,selected:client.model},request:payload,result,selection,telemetry:records,error,ending_source_fingerprint:verificationSource().sha256,explanation_review:'Unscored original tool explanation; inspect DEMO purchase units separately from KRW dataset units.'};
writeFileSync(directory+'/report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({directory,error,model:client.model,result,accepted:selection?.accepted,asset:selection?.deal?.currency_or_demo_asset,price_minor:selection?.deal?.price_minor,telemetry:records},null,2));
if(error||plan.source_fingerprint!==report.ending_source_fingerprint)process.exitCode=1;
