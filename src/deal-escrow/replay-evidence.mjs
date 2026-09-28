import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifyReceipt,efficiency} from './audit.ts';
import {hash} from './domain.ts';

// A replay is one closed evidence set, never the first matching rows from a
// mutable database. Its usage and failure-derived gate share those same IDs.
export async function assembleReplay(report,receipts){
  const fail=reason=>{throw new Error(reason);};
  if(!Array.isArray(report.results)||receipts.length!==report.results.length)fail('REPLAY_RECEIPT_MISSING');
  const ids=new Set();
  for(const r of receipts){
    const result=report.results.find(item=>item.id===r.deal.deal_id);
    if(ids.has(r.deal.deal_id)||!result||result.state!==r.state)fail('REPLAY_RESULT_MISMATCH');ids.add(r.deal.deal_id);
    if(r.network.chainId!==report.network.chainId||r.network.contract!==report.network.contract||r.network.controller!==report.network.controller)fail('REPLAY_DEPLOYMENT_MISMATCH');
    if((await verifyReceipt(r)).verdict!=='STRUCTURALLY_VALID')fail('REPLAY_RECEIPT_INVALID');
  }
  const a=receipts.find(r=>r.state==='SETTLED'&&r.deal.seller_id==='seller-a');
  const b=receipts.find(r=>r.state==='REFUNDED'&&r.deal.seller_id==='seller-b');
  const denied=receipts.find(r=>r.state==='PREVIEW_REQUIRED'&&r.deal.seller_id==='seller-b'&&r.events.some(e=>e.event_type==='TRANSACTION_BLOCKED'&&e.structured_payload.reason==='PREVIEW_REQUIRED'));
  if(!a||!b||!denied)fail('REPLAY_WORKFLOW_INCOMPLETE');
  if(denied.control?.origin_deal_id!==b.deal.deal_id||denied.control_source?.deal_hash!==b.deal_hash||Object.keys(denied.transactions).length)fail('REPLAY_CONTROL_SOURCE_MISMATCH');
  const measured=efficiency(receipts.flatMap(r=>r.kiln));
  const {generated_at:ignored,...usage}=measured;
  const {generated_at:reportedAt,...reportedUsage}=report.efficiency;
  if(hash(usage)!==hash(reportedUsage))fail('REPLAY_USAGE_MISMATCH');
  return {run:report.run,created_at:report.created_at,network:report.network,a,b,denied,receipts,efficiency:measured,recorded:true,semantic_truth_verified:false};
}
export async function loadReplay(index='artifacts/deal-escrow/sepolia/latest.json'){
  const report=JSON.parse(readFileSync(index,'utf8'));
  if(!/^[a-f0-9-]{36}$/.test(report.run))throw new Error('REPLAY_RUN_INVALID');
  const directory=path.resolve(`artifacts/deal-escrow/runs/${report.run}`);
  if(path.resolve(report.evidence_directory)!==directory)throw new Error('REPLAY_PATH_INVALID');
  const receipts=report.results.map(result=>{
    if(!/^[a-f0-9-]{36}$/.test(result.id))throw new Error('REPLAY_ID_INVALID');
    return JSON.parse(readFileSync(path.join(directory,`${result.id}.json`),'utf8'));
  });
  const data=await assembleReplay(report,receipts),verificationFile=path.join(directory,'independent-verification.json');
  const verification=existsSync(verificationFile)?JSON.parse(readFileSync(verificationFile,'utf8')):null;
  // A saved RPC verdict applies only to precisely the bytes that were checked.
  const verificationMatches=verification?.run===report.run&&verification?.status==='PASS'&&report.results.every(r=>verification.results?.some(v=>v.id===r.id&&v.verdict==='VALID'&&v.sha256===createHash('sha256').update(readFileSync(path.join(directory,`${r.id}.json`))).digest('hex')));
  return {...data,independent_verification:verificationMatches?verification:null};
}
