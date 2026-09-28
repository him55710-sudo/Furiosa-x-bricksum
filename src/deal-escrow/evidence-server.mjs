// Read-only judging surface. No wallet, API key, live model or database writer.
import express from 'express';
import path from 'node:path';
import {loadReplay} from './replay-evidence.mjs';
const app=express(),port=Number(process.env.ADE_EVIDENCE_PORT??3410);
app.disable('x-powered-by');
app.use((req,res,next)=>{if(!['127.0.0.1','localhost'].includes(req.hostname))return res.sendStatus(403);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'");if(req.method!=='GET'&&req.method!=='HEAD')return res.sendStatus(405);next();});
app.get('/api/replay',async(_req,res)=>{try{res.setHeader('Cache-Control','no-store');res.json(await loadReplay());}catch(e){res.status(409).json({error:e.message});}});
app.get('/api/audit/:id',async(req,res)=>{try{const data=await loadReplay(),receipt=data.receipts.find(r=>r.deal.deal_id===req.params.id);if(!receipt)return res.sendStatus(404);res.attachment(`deal-${receipt.deal.deal_id}.json`).json(receipt);}catch{res.sendStatus(409);}});
app.get('/',(req,res,next)=>{if(!req.query.replay)return res.redirect('/?replay=1');next();});
app.use(express.static(path.resolve('dist-deal-escrow-public')));
app.use((_req,res)=>res.sendStatus(404));
app.listen(port,'127.0.0.1',()=>console.log(`Read-only evidence demo: http://127.0.0.1:${port}/?replay=1`));
