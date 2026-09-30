import {readFileSync,writeFileSync,mkdirSync,existsSync,lstatSync} from 'node:fs';
import {assertPublicJson,vercelAllowlist,PUBLIC_CSP} from '../src/deal-escrow/public-files.mjs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {procurementEvidence} from './accord-public-proof.mjs';
export const PUBLIC_EVIDENCE=['report','buyer-transactions','normal','over-limit','wrong-delivery','preview-first','app-off','buyer-refund','independent-refund','independent'];
export function buildSpendingSite(root=process.cwd(),{outDir='dist-spending',testSummary:providedSummary}={}) {
 const out=path.resolve(root,outDir),source=path.join(root,'artifacts/deal-escrow/spending-proof');
 const read=name=>JSON.parse(readFileSync(path.join(source,name+'.json'),'utf8'));
 const finalized=existsSync(path.join(source,'independent-finalized.json'));
 const report=read('report'),independent=read(finalized?'independent-finalized':'independent'),preview=read('preview-first');
 if(report.status!=='PASS'||independent.status!=='PASS'||report.funding_mode!=='buyer-vault'||report.deployment.chainId!==11155111)throw Error('PUBLIC_PROOF_REQUIRED');
 if(independent.results.length!==5||independent.results.some(x=>x.verdict!=='VALID'))throw Error('INDEPENDENT_VERIFICATION_REQUIRED');
 if(report.results.length!==5||new Set(report.results.map(x=>x.scenario)).size!==5||independent.contract!==report.deployment.contract||independent.chain_id!==report.deployment.chainId)throw Error('PROOF_BINDING_MISMATCH');
 for(const item of independent.results)if(!report.results.some(x=>x.scenario===item.scenario&&x.state===item.state))throw Error('PROOF_BINDING_MISMATCH');
 for(const item of report.results){const bundle=read(item.scenario);if(bundle.state!==item.state||bundle.deal.deal_id!==item.id||bundle.network.contract!==report.deployment.contract)throw Error('INCONSISTENT_SCENARIO');}
 if(preview.control.origin_deal_id!==report.preview_gate.origin_deal_id||preview.control.origin_deal_id!==read('wrong-delivery').deal.deal_id)throw Error('MEMORY_ORIGIN_MISMATCH');
 for(const directory of [out,path.join(out,'evidence')])if(lstatSync(directory,{throwIfNoEntry:false})?.isSymbolicLink())throw Error('PUBLIC_OUTPUT_SYMLINK');
 mkdirSync(path.join(out,'evidence'),{recursive:true});
 const files=[];
 // Stage in memory first: invalid evidence must not partially replace a prior build.
 const staged=new Map();
 function publish(name,bytes){if(name.endsWith('.json'))assertPublicJson(JSON.parse(String(bytes)));staged.set(name,bytes);files.push({path:name,bytes:Buffer.byteLength(bytes),sha256:createHash('sha256').update(bytes).digest('hex')});}
 for(const name of ['index.html','workspace.css','deal-room.css','presentation.css','product.css','product-view.mjs','presentation-model.mjs','presentation-view.mjs','app.mjs','workspace-client.mjs','workspace-model.mjs','workspace-view.mjs','deal-room.mjs','live-view.mjs','live-chat.mjs','live-session.mjs','live-client.mjs','policy-simulator.mjs','favicon.svg'])publish(name,readFileSync(path.join(root,'web/spending',name)));
 for(const name of PUBLIC_EVIDENCE)publish(`evidence/${name}.json`,readFileSync(path.join(source,(name==='independent'&&finalized?'independent-finalized':name)+'.json')));
 if(existsSync(path.join(source,'independent-finalized.json')))publish('evidence/independent-finalized.json',readFileSync(path.join(source,'independent-finalized.json')));
 // Keep the complete local test report. The public summary excludes stack
 // traces/stdout/stderr, which can contain host paths or incidental inputs.
 const {output,stderr,runner_error,...testSummary}=providedSummary??JSON.parse(readFileSync(path.join(root,'artifacts/deal-escrow/tests.json'),'utf8'));
 for(const [name,value] of Object.entries(procurementEvidence(root)))publish(`evidence/${name}.json`,JSON.stringify(value,null,2));
 publish('evidence/tests.json',JSON.stringify({...testSummary,public_summary:true},null,2));
 const config={framework:null,buildCommand:null,outputDirectory:'.',headers:[{source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'},{key:'Content-Security-Policy',value:"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'"}]},{source:'/evidence/(.*)',headers:[{key:'Cache-Control',value:'public, max-age=0, must-revalidate'}]}]};
 publish('vercel.json',JSON.stringify(config,null,2));
 config.headers[0].headers=config.headers[0].headers.map(h=>h.key==='Content-Security-Policy'?{...h,value:PUBLIC_CSP}:h);
 config.headers[0].headers.push({key:'Cross-Origin-Resource-Policy',value:'same-origin'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=()'});
 staged.set('vercel.json',JSON.stringify(config,null,2));
 const configFile=files.find(f=>f.path==='vercel.json'),configBytes=staged.get('vercel.json');configFile.bytes=Buffer.byteLength(configBytes);configFile.sha256=createHash('sha256').update(configBytes).digest('hex');
 const publicPaths=[...files.map(f=>f.path),'evidence/site-manifest.json'];
 staged.set('.vercelignore',vercelAllowlist(publicPaths));
 const version=createHash('sha256').update(JSON.stringify(files)).digest('hex');
 const manifest={schema_version:1,site_version:version,built_at:new Date().toISOString(),public_run:report.run,scope:'Static workspace client and historical public proof. Task processing requires the loopback workspace service; local EVM only.',files};
 staged.set('evidence/site-manifest.json',JSON.stringify(manifest,null,2));
 // Never follow a file or directory link while publishing into the build output.
 for(const name of ['', 'evidence',...staged.keys()]){const destination=path.join(out,name);if(lstatSync(destination,{throwIfNoEntry:false})?.isSymbolicLink())throw Error('PUBLIC_OUTPUT_SYMLINK');}
 for(const [name,bytes] of staged)writeFileSync(path.join(out,name),bytes);
 console.log(JSON.stringify({status:'BUILT',out,files:files.length,site_version:version}));return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve('scripts/build-deal-escrow-spending.mjs'))buildSpendingSite();
