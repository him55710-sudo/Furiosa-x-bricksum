import {readFileSync,existsSync} from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {verifyReceipt} from './audit.ts';
export async function loadBuyerRecovery(sourceRun,contract){
  const index='artifacts/deal-escrow/source-recovery/latest.json';if(!existsSync(index))return null;
  const read=p=>JSON.parse(readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),entry=read(index);
  if(!/^[a-f0-9-]{36}$/.test(entry.run)||path.resolve(entry.directory)!==path.resolve(`artifacts/deal-escrow/source-recovery/${entry.run}`))throw new Error('RECOVERY_PATH_INVALID');
  const dir=entry.directory,packet=read(`${dir}/public-packet.json`);if(packet.related_source_run!==sourceRun)return null;
  const receipt=read(`${dir}/reconciled-receipt.json`),report=read(`${dir}/report.json`);
  if(packet.contract!==contract||receipt.network.contract!==contract||packet.run!==entry.run||report.run!==entry.run||report.status!=='PASS'||receipt.state!=='REFUNDED'||receipt.schema_version!==3||packet.deal_id!==receipt.deal.deal_id||packet.deal_hash!==receipt.deal_hash||report.buyer_helper?.tx_hash!==receipt.transactions.refund.tx_hash||(await verifyReceipt(receipt)).verdict!=='STRUCTURALLY_VALID')throw new Error('RECOVERY_EVIDENCE_MISMATCH');
  const file=`${dir}/independent-verification.json`,v=existsSync(file)?read(file):null,verified=v?.run===entry.run&&v.status==='PASS'&&v.verdict==='VALID'&&v.receipt_sha256===sha(`${dir}/reconciled-receipt.json`)&&v.packet_sha256===sha(`${dir}/public-packet.json`);
  return {run:entry.run,packet,receipt,report,independent_verification:verified?v:null};
}
