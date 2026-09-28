import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {openChain} from '../src/deal-escrow/chain.mjs';
import {DealStore} from '../src/deal-escrow/store.ts';
import {DealEngine} from '../src/deal-escrow/engine.ts';
import {now,defaultTaskRequirements} from '../src/deal-escrow/domain.ts';
import {fixtureDelivery} from '../src/deal-escrow/delivery.ts';
import {receipt,verifyReceipt} from '../src/deal-escrow/audit.ts';

export async function createPersonaDemo(){
  const id='persona-'+randomUUID(),directory=path.resolve('data/private/deal-escrow',id),out=path.resolve('artifacts/deal-escrow/personas',id);
  await mkdir(out,{recursive:true});const chain=await openChain({directory}),store=new DealStore(path.join(directory,'state.sqlite')),engine=new DealEngine(store,chain),results=[];
  function task(){const t=now(),m={mandate_id:randomUUID(),company_id:'persona-research-company',buyer_id:'research-agent-07',task_budget_minor:300,max_single_minor:200,allowed_sellers:['seller-a','seller-b'],category:'RESEARCH_DATA',status:'ACTIVE',created_at:t,expires_at:t+7200,task_requirements:structuredClone(defaultTaskRequirements)};engine.mandate(m);return m;}
  function propose(seller,patch={}){const m=task(),intent=store.getOrCreateIntent(m.mandate_id,seller),t=now(),d={deal_id:intent.deal_id,buyer_id:m.buyer_id,seller_id:seller,price_minor:150,currency_or_demo_asset:'DEMO',deliverable_type:'CAPEX_DATASET',requirements:{minimum_rows:40,required_columns:['company','quarter','capex','currency','source_url'],minimum_source_coverage:.9,format:'JSON'},deadline:180,created_at:t,expires_at:t+3600,supersedes_deal_id:null,...patch};engine.propose(d,m.mandate_id);engine.agentAction('accept_deal',{deal_id:d.deal_id});store.updateIntent(intent.id,{status:'COMPLETED'});return d.deal_id;}
  try{
    const success=propose('seller-a');await engine.fund(success);await engine.deliver(success,fixtureDelivery());assert.equal(store.get(success).state,'SETTLED');
    const failed=propose('seller-b');await engine.fund(failed);await engine.deliver(failed,JSON.stringify(Array(40).fill({company:null,quarter:null,capex:'fake',currency:null,source_url:'https://example.org/seller-claim'})));assert.equal(store.get(failed).state,'REFUNDED');
    const preview=propose('seller-b');await engine.fund(preview);assert.equal(store.get(preview).state,'PREVIEW_REQUIRED');
    const quality=propose('seller-a',{requirements:{minimum_rows:1,required_columns:['company','quarter','capex','currency','source_url'],minimum_source_coverage:0,format:'JSON'}});await engine.fund(quality);assert.equal(store.get(quality).state,'BLOCKED');
    const budget=propose('seller-a',{price_minor:250});await engine.fund(budget);assert.equal(store.get(budget).state,'BLOCKED');
    for(const [name,dealId] of Object.entries({success,failed,preview,quality,budget})){const record=receipt(engine,dealId),verification=await verifyReceipt(record,chain);assert.equal(verification.verdict,'VALID',`${name}: ${verification.reason}`);await writeFile(path.join(out,name+'.json'),JSON.stringify(record,null,2));results.push({name,id:dealId,state:record.state,verification});}
    const report={id,created_at:new Date().toISOString(),evidence_level:'SCRIPTED_PERSONAS_REAL_SQLITE_LOCAL_EVM',directory,out,preview_id:preview,results,model_calls:0,public_chain_transactions:0};await writeFile(path.join(out,'demo.json'),JSON.stringify(report,null,2));return report;
  }finally{store.close();await chain.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)console.log(JSON.stringify(await createPersonaDemo(),null,2));
