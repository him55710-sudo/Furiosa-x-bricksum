import {lstatSync,realpathSync} from 'node:fs';
import path from 'node:path';

export const PUBLIC_CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
export function assertPublicJson(value){
 const secret=/^(private_?key|secret_?key|mnemonic|seed_phrase|api_?key|access_?token|refresh_?token|authorization|raw_?transaction|signed_?transaction)$/i;
 function visit(v,depth=0){
  if(depth>100)throw Error('PUBLIC_EVIDENCE_TOO_DEEP');
  if(typeof v==='string'&&/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(v))throw Error('PUBLIC_SECRET_DETECTED');
  if(!v||typeof v!=='object')return;
  for(const [key,item] of Object.entries(v)){if(secret.test(key)&&item!==null&&item!=='')throw Error('PUBLIC_SECRET_DETECTED');visit(item,depth+1);}
 }
 visit(value);
}
export function vercelAllowlist(files){
 const paths=[...new Set(files)].sort();
 if(paths.some(p=>!/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(p)||p.split('/').some(s=>s==='..'||s==='.'||s.startsWith('.'))))throw Error('INVALID_PUBLIC_PATH');
 // Deny unknown files even when they were left in the distribution by a prior run.
 return '/*\n'+paths.filter(p=>p.includes('/')).map(p=>'!'+p.slice(0,p.lastIndexOf('/'))+'\n').filter((p,i,a)=>a.indexOf(p)===i).join('')+'/evidence/*\n'+paths.map(p=>'!'+p).join('\n')+'\n';
}
export function allowlistedStatic(root,files){
 const base=realpathSync(root),allowed=new Set(files);
 return (req,res,next)=>{
  if(!['GET','HEAD'].includes(req.method))return res.status(405).set('Allow','GET, HEAD').end();
  let name;try{name=decodeURIComponent(req.path); }catch{return res.sendStatus(400);}
  name=name==='/'?'index.html':name.slice(1);
  if(!allowed.has(name))return res.sendStatus(404);
  try{
   const file=path.join(base,name),resolved=realpathSync(file);
   if(!resolved.startsWith(base+path.sep)||lstatSync(file).isSymbolicLink()||!lstatSync(file).isFile())return res.sendStatus(404);
   res.sendFile(resolved,err=>{if(err&&!res.headersSent)res.sendStatus(404);});
  }catch{res.sendStatus(404);}
 };
}
