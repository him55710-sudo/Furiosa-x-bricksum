import express from 'express';
import {randomBytes} from 'node:crypto';
import {localBoundary,localSession} from '../deal-escrow/http-security.mjs';
import {PUBLIC_CSP,allowlistedStatic,assertPublicJson} from '../deal-escrow/public-files.mjs';
export function workspaceApp({workspace,port,root,files}){
 const app=express(),token=randomBytes(32).toString('hex');
 app.disable('x-powered-by');app.use(localBoundary({port,csp:PUBLIC_CSP}));
 app.use('/api',express.json({limit:'2mb'}),localSession(token));
 app.get('/api/workspace',(_req,res)=>res.json({token,network:workspace.network(),tasks:workspace.list()}));
 app.get('/api/sample',(_req,res)=>res.json(workspace.sample()));
 app.get('/api/tasks/:id',(req,res)=>res.json(workspace.get(req.params.id)));
 app.post('/api/tasks',async(req,res)=>res.status(201).json(await workspace.create(req.body)));
 app.post('/api/tasks/:id/:action',async(req,res)=>res.json(await workspace.act(req.params.id,req.params.action,req.body)));
 app.get('/api/tasks/:id/receipt',(req,res)=>{const value=workspace.export(req.params.id);assertPublicJson(value);res.set('Content-Disposition',`attachment; filename="accord-${value.task.id}.json"`).json(value);});
 app.get('/api/tasks/:id/verify',async(req,res)=>res.json(await workspace.verify(req.params.id)));
 app.use(allowlistedStatic(root,files));
 app.use((err,_req,res,_next)=>{const message=String(err.message??'');const safe=message.length<300&&!/[\\/]|SQLITE|ENOENT|private key|0x[a-f0-9]{40}/i.test(message);res.status(err.type==='entity.too.large'?413:400).json({error:safe?message:'The operation could not complete. Refresh the task and check its current state.'});});
 return app;
}
