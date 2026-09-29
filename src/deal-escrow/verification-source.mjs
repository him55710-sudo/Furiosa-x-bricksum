import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';

export function verificationSource(root=process.cwd()){
  const files=[];
  function walk(relative){if(!existsSync(path.join(root,relative)))return;for(const entry of readdirSync(path.join(root,relative),{withFileTypes:true})){const name=path.posix.join(relative,entry.name);if(entry.isDirectory())walk(name);else if(/\.(mjs|js|ts|tsx|html|css)$/.test(name))files.push(name);}}
  for(const directory of ['src/deal-escrow','src/dealtrace','tests/deal-escrow','web/dealtrace','web/deal-escrow','web/deal-escrow-public'])walk(directory);
  for(const file of ['tsconfig.deal-escrow-public.json','vite.deal-escrow-public.config.ts','requirements-pdf.txt','data/reference/capex/source-documents.json','scripts/read-deal-research-pdf.py','scripts/run-dealtrace.mjs','verification/source-document.integration.mjs'])if(existsSync(path.join(root,file)))files.push(file);
  for(const run of ['a19c9740-e56d-4de3-acdb-e4a2fd4d24c9','d07e8650-bc47-4ecd-b138-8885d8288a04']){const directory=`artifacts/deal-escrow/runs/${run}`;if(existsSync(path.join(root,directory)))for(const file of readdirSync(path.join(root,directory)))if(file==='report.json'||/^[a-f0-9-]{36}\.json$/.test(file))files.push(`${directory}/${file}`);}
  const sourceRun='artifacts/deal-escrow/source-sepolia/a2f6f4fa-9f1e-4892-8518-325b8762c4f2';
  if(existsSync(path.join(root,sourceRun)))for(const file of readdirSync(path.join(root,sourceRun)))if(['report.json','energy-estimate.json'].includes(file)||/^[a-f0-9-]{36}\.json$/.test(file))files.push(`${sourceRun}/${file}`);
  const recoveryRun='artifacts/deal-escrow/source-recovery/5b2ccb95-10b9-4f62-a51a-73761d51c336';
  for(const name of ['report.json','public-packet.json','funded-receipt.json','reconciled-receipt.json','buyer-refund.json'])if(existsSync(path.join(root,recoveryRun,name)))files.push(`${recoveryRun}/${name}`);
  for(const file of ['contracts/AgentDealEscrow.sol','artifacts/deal-escrow/contract.json','package.json','pnpm-lock.yaml','tsconfig.deal-escrow.json','vite.deal-escrow.config.ts','verification/deal-personas.mjs','data/reference/capex/lges-2025-v1.json','data/reference/capex/lges-2025-source-packet.json'])if(existsSync(path.join(root,file)))files.push(file);
  if(existsSync(path.join(root,'scripts')))for(const file of readdirSync(path.join(root,'scripts')))if(/deal-(escrow|personas|research).*\.mjs$/.test(file))files.push(`scripts/${file}`);
  const aggregate=createHash('sha256'),manifest=files.sort().map(file=>{const data=readFileSync(path.join(root,file));aggregate.update(file+'\0').update(data).update('\0');return {path:file,sha256:createHash('sha256').update(data).digest('hex')};});
  return {sha256:aggregate.digest('hex'),files:manifest};
}
