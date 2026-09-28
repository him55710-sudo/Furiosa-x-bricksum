import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {JsonRpcProvider} from 'ethers';
import {Store} from '../src/store.mjs';
import {Engine} from '../src/engine.mjs';
import {verifyBundle} from '../src/verifier.mjs';
const deployment=JSON.parse(await readFile('artifacts/devnet/deployment.json','utf8'));
const artifact=JSON.parse(await readFile('artifacts/contracts/BudgetVault.json','utf8'));
const provider=new JsonRpcProvider(deployment.rpcUrl,deployment.chainId);
const chain={deployment,domain:{name:'ControlMemory',version:'1',chainId:deployment.chainId,verifyingContract:deployment.vault}};
const store=new Store(),engine=new Engine({store,chain}),out='artifacts/demo/evidence';await mkdir(out,{recursive:true});
try{
  const ids=new Set(store.all('session').filter(s=>s.policy.metadata.name.startsWith('GWDC ')).map(s=>s.id));
  const rows=[];
  for(const r of store.all('run').filter(r=>ids.has(r.sessionId)&&['SETTLED','STOPPED','REVIEW_REQUIRED'].includes(r.status))){
    const bundle=engine.bundle(r.id),file=`${r.scenarioId}-${r.id.slice(2,10)}.json`;
    const verification=await verifyBundle(bundle,{provider,deployment,abi:artifact.abi});
    await writeFile(`${out}/${file}`,JSON.stringify(bundle,null,2)+'\n');
    rows.push({runId:r.id,scenarioId:r.scenarioId,status:r.status,reason:r.reason,calls:r.usage.length,tokens:r.usage.every(u=>u.totalTokens!=null)?r.usage.reduce((n,u)=>n+u.totalTokens,0):null,flows:r.usage,txHash:r.receipt?.hash??null,bundle:`evidence/${file}`,verification});
  }
  const completed=rows.find(r=>r.status==='SETTLED');let adversarial;
  if(completed){const bundle=JSON.parse(await readFile(`artifacts/demo/${completed.bundle}`,'utf8'));
    const tampered=structuredClone(bundle);tampered.run.offer.offer.total='1';const incomplete=structuredClone(bundle);delete incomplete.preEvidence;
    adversarial={tampered:await verifyBundle(tampered,{provider,deployment,abi:artifact.abi}),missing:await verifyBundle(incomplete,{provider,deployment,abi:artifact.abi}),offline:await verifyBundle(bundle)};
  }
  const summary={schemaVersion:1,generatedAt:new Date().toISOString(),scope:'Real product Kiln calls and local EVM devnet TestCredit transfers. Public testnet, physical NPU routing and energy not independently verified.',deployment,rows,adversarial};
  await writeFile('artifacts/demo/acceptance.json',JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify({runs:rows.map(({scenarioId,status,calls,tokens,txHash,verification})=>({scenarioId,status,calls,tokens,txHash,verification:verification.status})),adversarial}));
}finally{store.close();provider.destroy();}
