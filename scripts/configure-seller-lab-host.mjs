// Only the dedicated lab project receives these credentials. Never log their values.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const cwd=resolve('data/private/generalization-deploy'),pnpm=process.argv[2];if(!pnpm)throw new Error('PNPM_EXECUTABLE_REQUIRED');
const link=JSON.parse(readFileSync(cwd+'/.vercel/project.json'));if(link.projectName!=='accord-seller-lab')throw new Error('WRONG_PROJECT');
const file=cwd+'/connection.private.json';
const connection=existsSync(file)?JSON.parse(readFileSync(file)):{id:'researchcloud-lab',url:'https://accord-seller-lab.vercel.app',token:randomBytes(32).toString('hex')};
writeFileSync(file,JSON.stringify(connection),{mode:0o600});
const config={id:connection.id,mode:'NORMAL',capabilities:['document','search','compute'],policy:{floors:{document:1200,search:200,compute:400},min_delivery_seconds:180,quality:'ACTUAL_WITH_SOURCES'}};
for(const [name,value] of [['LAB_TOKEN',connection.token],['LAB_CONFIG_JSON',JSON.stringify(config)]]){
 const result=spawnSync(pnpm,['dlx','vercel','env','add',name,'production','--scope','mongben'],{cwd,input:value,encoding:'utf8',shell:true,timeout:60000});
 if(result.status!==0)throw new Error(`ENV_ADD_FAILED:${name}:${result.status}`);console.log(`Configured ${name} for dedicated lab project.`);
}
