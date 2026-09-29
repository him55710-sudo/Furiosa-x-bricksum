import {blobLiveStore} from './live-store.mjs';
import {createLiveService} from './live-service.mjs';
import {createLiveNegotiation} from './live-negotiation.mjs';
import {liveHandler} from './live-http.mjs';

let handler;
export default async function(req,res){
 const {ACCORD_LIVE_SECRET,KILN_API_KEY,KILN_MODEL,BLOB_READ_WRITE_TOKEN}=process.env;
 if(!ACCORD_LIVE_SECRET||!KILN_API_KEY||!KILN_MODEL||!BLOB_READ_WRITE_TOKEN){res.setHeader('Cache-Control','no-store');return res.status(503).json({available:false,error:'LIVE_SERVICE_NOT_CONFIGURED'});}
 handler??=liveHandler({secret:ACCORD_LIVE_SECRET,service:createLiveService({store:blobLiveStore({key:`accord/${process.env.VERCEL_ENV==='production'?'production':'preview'}/ledger-v1.json`}),negotiation:createLiveNegotiation({secret:ACCORD_LIVE_SECRET}),callBudget:Number(process.env.ACCORD_LIVE_CALL_BUDGET??60)})});
 return handler(req,res);
}
