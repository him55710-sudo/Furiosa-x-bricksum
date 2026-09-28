import {Store} from './store.mjs';
import {connectPurchaseWorker} from './purchase-chain.mjs';
import {PurchaseEngine} from './purchase-engine.mjs';
import {ResearchModel} from './purchase-model.mjs';
import {SellerClient} from './purchase-seller.mjs';
import {sourceManifest} from './purchase-source.mjs';
const directory=process.argv[2];
const {chain,config}=await connectPurchaseWorker(directory);
if(!config.runtime||config.runtime.hash!==(await sourceManifest()).hash)throw new Error('WORKER_SOURCE_CHANGED_RESTART_SERVER');
const store=new Store(config.database),seller=new SellerClient({url:config.sellerUrl,chain});
const engine=new PurchaseEngine({store,chain,model:new ResearchModel(),seller,runtime:config.runtime});
for(const p of store.all('purchase').filter(p=>p.tx&&p.workflow!=='COMPLETE')){try{await engine.sync(p.id);}catch{}}
let busy=false;
process.on('message',async message=>{
  if(message?.type!=='run'||busy)return;
  busy=true;
  try{const result=await engine.run(message.purchaseId,{scenario:message.scenario});process.send?.({type:'done',purchaseId:message.purchaseId,workflow:result.workflow});}
  catch(e){process.send?.({type:'done',purchaseId:message.purchaseId,error:/^[A-Z_]+$/.test(e.message)?e.message:'WORKER_FAILED'});}
  finally{busy=false;}
});
process.send?.({type:'ready',pid:process.pid});
