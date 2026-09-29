// Run `before`, redeploy the same dedicated service, then run `after`.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {connectProvider} from '../src/dealtrace/procurement/client.mjs';
import {hash,ensure} from '../src/deal-escrow/domain.ts';
const [phase,file]=process.argv.slice(2);ensure(['before','after'].includes(phase)&&file,'ARGUMENTS');
const client=connectProvider(JSON.parse(readFileSync(file))),identity=await client.request('/identity'),evidence=await client.request('/evidence');
const path='artifacts/generalization/external/persistence';mkdirSync(path,{recursive:true});
const snapshot={checked_at:new Date().toISOString(),identity,evidence_hash:hash(evidence),commits:evidence.commits,event_count:evidence.events.length,unit_count:evidence.units.length,request_count:evidence.request_count};
if(phase==='after'){
 const before=JSON.parse(readFileSync(path+'/before.json'));
 snapshot.checks={different_deployment:identity.instance!==before.identity.instance,same_key:identity.address===before.identity.address,same_durable_evidence:snapshot.evidence_hash===before.evidence_hash};
 ensure(Object.values(snapshot.checks).every(Boolean),'REMOTE_PERSISTENCE_FAILED');
}
writeFileSync(`${path}/${phase}.json`,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({phase,...(snapshot.checks??{}),events:snapshot.event_count,commits:snapshot.commits.length}));
