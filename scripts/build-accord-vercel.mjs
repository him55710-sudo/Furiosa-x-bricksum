import path from 'node:path';
import {mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build} from 'vite';
import {buildSpendingSite} from './build-deal-escrow-spending.mjs';
import {PUBLIC_CSP,vercelAllowlist} from '../src/deal-escrow/public-files.mjs';
export async function buildHostedSite(root=process.cwd(),{outDir='dist-vercel',stagingDir='data/private/accord-hosted-staging',testSummary}={}){
const out=path.resolve(root,outDir),stage=path.resolve(root,stagingDir);
const proof=buildSpendingSite(root,{outDir:stage,testSummary});
const result=await build({configFile:false,root:path.join(root,'web/spending'),publicDir:false,resolve:{alias:{'./workspace-client.mjs':path.join(root,'web/spending/browser-workspace.mjs')}},build:{outDir:out,emptyOutDir:false,target:'es2022',sourcemap:false,rollupOptions:{input:path.join(root,'web/spending/index.html')}}});
const files=result.output.map(item=>item.fileName);
function copy(source,destination){mkdirSync(path.dirname(path.join(out,destination)),{recursive:true});copyFileSync(source,path.join(out,destination));files.push(destination);}
copy(path.join(root,'web/spending/favicon.svg'),'favicon.svg');
copy(path.join(root,'node_modules/ganache/dist/web/ganache.min.js'),'vendor/ganache-7.9.2.min.js');
copy(path.join(root,'node_modules/ganache/dist/web/ganache.min.js.LICENSE.txt'),'vendor/ganache-LICENSE.txt');
for(const f of proof.files.filter(f=>f.path.startsWith('evidence/')))copy(path.join(stage,f.path),f.path);
const config={framework:null,buildCommand:null,installCommand:null,outputDirectory:'.',headers:[{source:'/(.*)',headers:[{key:'Content-Security-Policy',value:PUBLIC_CSP.replace("script-src 'self'","script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'").replace("connect-src 'self'","connect-src 'self' data:")},{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'no-referrer'},{key:'X-Frame-Options',value:'DENY'},{key:'Cross-Origin-Resource-Policy',value:'same-origin'}]},{source:'/assets/(.*)',headers:[{key:'Cache-Control',value:'public,max-age=31536000,immutable'}]},{source:'/vendor/(.*)',headers:[{key:'Cache-Control',value:'public,max-age=31536000,immutable'}]},{source:'/',headers:[{key:'Cache-Control',value:'public,max-age=0,must-revalidate'}]}]};
writeFileSync(path.join(out,'vercel.json'),JSON.stringify(config,null,2));files.push('vercel.json');
const manifest={product:'accord lock',mode:'BROWSER_EVM',scope:'Data processing and actual private-EVM execution in the visitor browser. IndexedDB persistence; no cloud sync or public funds.',files:[...new Set(files)].sort().map(name=>({path:name,bytes:readFileSync(path.join(out,name)).length,sha256:createHash('sha256').update(readFileSync(path.join(out,name))).digest('hex')}))};
mkdirSync(path.join(out,'evidence'),{recursive:true});writeFileSync(path.join(out,'evidence/hosted-manifest.json'),JSON.stringify(manifest,null,2));files.push('evidence/hosted-manifest.json');
writeFileSync(path.join(out,'.vercelignore'),vercelAllowlist(files));
console.log(JSON.stringify({status:'BUILT',out,mode:manifest.mode,files:files.length}));

return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve('scripts/build-accord-vercel.mjs'))await buildHostedSite();
