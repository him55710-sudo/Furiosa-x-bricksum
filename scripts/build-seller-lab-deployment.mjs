import {mkdirSync,writeFileSync,copyFileSync,readFileSync,existsSync} from 'node:fs';
import {build} from '../node_modules/.pnpm/node_modules/esbuild/lib/main.js';
import {createHash} from 'node:crypto';
const out='data/private/generalization-deploy';mkdirSync(out,{recursive:true});
await build({entryPoints:['verification/generalization/seller-server.mjs'],outfile:out+'/server.mjs',bundle:true,platform:'node',format:'esm',target:'node24',packages:'external'});
// Preserve reference-file paths after flattening source modules into one bundle.
const bundled=readFileSync(out+'/server.mjs','utf8');
if((bundled.match(/\.\.\/\.\.\/data\/reference\/capex\//g)??[]).length!==3)throw new Error('REFERENCE_BUNDLE_PATHS_CHANGED');
writeFileSync(out+'/server.mjs',bundled.replaceAll('../../data/reference/capex/','./data/reference/capex/'));
writeFileSync(out+'/package.json',JSON.stringify({name:'accord-seller-lab',private:true,type:'module',engines:{node:'24.x'},dependencies:{ethers:'6.17.0',express:'5.2.1','@vercel/blob':'2.7.0'}},null,2)+'\n');
writeFileSync(out+'/.vercelignore','node_modules\n.env*\n*.log\nconnection.private.json\n');
writeFileSync(out+'/vercel.json',JSON.stringify({framework:'express',functions:{'server.mjs':{includeFiles:'data/reference/capex/**',maxDuration:120}}},null,2)+'\n');
if(existsSync('verification/generalization/deployment.pnpm-lock.yaml'))copyFileSync('verification/generalization/deployment.pnpm-lock.yaml',out+'/pnpm-lock.yaml');
mkdirSync(out+'/data/reference/capex',{recursive:true});
for(const name of ['lges-2025-v1.json','lges-2025-source-packet.json','source-documents.json'])copyFileSync('data/reference/capex/'+name,out+'/data/reference/capex/'+name);
console.log(JSON.stringify({directory:out,bundle_sha256:createHash('sha256').update(readFileSync(out+'/server.mjs')).digest('hex')}));
