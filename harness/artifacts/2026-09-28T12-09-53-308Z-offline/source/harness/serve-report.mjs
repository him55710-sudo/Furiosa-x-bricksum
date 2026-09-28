import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('harness/artifacts'),directory=path.resolve(process.argv[2]??'');
if(!directory.startsWith(root+path.sep))throw new Error('REPORT_DIRECTORY_REQUIRED');
const server=createServer(async(req,res)=>{
  if(req.method!=='GET'){res.writeHead(405).end();return;}
  const name=new URL(req.url,'http://127.0.0.1').pathname;
  // Only these public generated artifacts are exposed; no directory traversal/listing.
  const file={'/':'dashboard.html','/dashboard.html':'dashboard.html','/report.json':'report.json','/verification.json':'verification.json'}[name];
  if(!file){res.writeHead(404).end();return;}
  try{const b=await readFile(path.join(directory,file));res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(b);}catch{res.writeHead(404).end('Report not yet generated');}
});
server.listen(3471,'127.0.0.1',()=>console.log('Evaluation report: http://127.0.0.1:3471'));
