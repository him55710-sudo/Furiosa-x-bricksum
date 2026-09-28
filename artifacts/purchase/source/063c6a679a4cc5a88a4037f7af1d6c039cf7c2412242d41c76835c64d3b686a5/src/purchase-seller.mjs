import express from 'express';
import {randomBytes} from 'node:crypto';
import {verifyTypedData,TypedDataEncoder} from 'ethers';
import {CONSENT_TYPES,QUOTE_TYPES,ACCESS_TYPES,DELIVERY_TYPES,DOCUMENT,hash,sameAddress,nowSeconds} from '../shared/purchase.mjs';
export function sellerApp({chain,store}){
  const app=express();app.disable('x-powered-by');app.use(express.json({limit:'100kb'}));
  app.post('/quote',async(req,res)=>{
    const {consent,signature,scenario='normal'}=req.body;
    if(!sameAddress(verifyTypedData(chain.domain,CONSENT_TYPES,consent,signature),consent.owner))throw new Error('OWNER_SIGNATURE');
    if(!['normal','drop-response','unrecoverable','over-budget','unlisted','expired'].includes(scenario))throw new Error('INVALID_SCENARIO');
    const seller=scenario==='unlisted'?'outsider':'beta',merchant=chain.merchant(seller).address;
    const quote={purchaseId:consent.purchaseId,owner:consent.owner,resourceSpecHash:consent.resourceSpecHash,offerId:hash(randomBytes(24).toString('hex')),merchant,subtotal:scenario==='over-budget'?'500':'600',fee:scenario==='over-budget'?'700':'0',total:scenario==='over-budget'?'1200':'600',expiresAt:String(nowSeconds()+(scenario==='expired'?-1:600))};
    const record={quote,signature:await chain.sellers[seller].signTypedData(chain.domain,QUOTE_TYPES,quote)};
    store.put('sellerQuote',TypedDataEncoder.hash(chain.domain,QUOTE_TYPES,quote),{...record,scenario});res.json(record);
  });
  app.post('/challenge',async(req,res)=>{
    const {owner,purchaseId}=req.body,key=chain.key(owner,purchaseId),c=await chain.vault.consents(key);
    if(!sameAddress(c.owner,owner)||c.purchaseId!==purchaseId)throw new Error('PURCHASE_NOT_FOUND');
    const challenge={purchaseId,owner,resourceSpecHash:c.resourceSpecHash,nonce:hash(randomBytes(24).toString('hex')),expiresAt:String(nowSeconds()+90)};
    store.put('sellerChallenge',challenge.nonce,challenge);res.json(challenge);
  });
  app.post('/retrieve',async(req,res)=>{
    const {challenge,signature}=req.body;
    const saved=store.get('sellerChallenge',challenge?.nonce);
    if(!saved||saved.used||hash(saved)!==hash(challenge)||Number(saved.expiresAt)<=nowSeconds())throw new Error('ACCESS_CHALLENGE_INVALID');
    const signer=verifyTypedData(chain.domain,ACCESS_TYPES,challenge,signature);
    // The approved buyer and the designated payment/recovery executor may retrieve.
    if(!sameAddress(signer,challenge.owner)&&!sameAddress(signer,chain.deployment.executor))throw new Error('ACCESS_SIGNATURE');
    store.transaction(()=>{const latest=store.get('sellerChallenge',challenge.nonce);if(latest.used)throw new Error('ACCESS_CHALLENGE_USED');store.put('sellerChallenge',challenge.nonce,{...latest,used:true});});
    const state=await chain.state(challenge.owner,challenge.purchaseId);
    if(!state.settled||!state.receipt||!state.event)throw new Error('PAYMENT_NOT_FOUND');
    const sale=store.get('sellerQuote',state.event.offerDigest);
    if(!sale||state.event.resourceSpecHash!==challenge.resourceSpecHash)throw new Error('SALE_NOT_FOUND');
    if(sale.scenario==='unrecoverable')return res.status(410).json({error:'RESULT_UNRECOVERABLE'});
    const key=chain.key(challenge.owner,challenge.purchaseId);let record=store.get('sellerDelivery',key);
    if(!record){
      if(hash(DOCUMENT.resource)!==challenge.resourceSpecHash)throw new Error('RESOURCE_UNAVAILABLE');
      const delivery={purchaseId:challenge.purchaseId,owner:challenge.owner,resourceSpecHash:challenge.resourceSpecHash,contentHash:hash(DOCUMENT),paymentTx:state.receipt.hash};
      const wallet=Object.values(chain.sellers).find(w=>sameAddress(w.address,state.event.merchant));
      record={document:DOCUMENT,delivery,signature:await wallet.signTypedData(chain.domain,DELIVERY_TYPES,delivery)};store.put('sellerDelivery',key,record);
    }
    if(req.headers['x-demo-drop-response']==='1'&&sameAddress(signer,chain.deployment.executor)){
      store.event(key,'DEMO_RESPONSE_SOCKET_DESTROYED',{paymentTx:state.receipt.hash,contentHash:record.delivery.contentHash});req.socket.destroy();return;
    }
    res.json(record);
  });
  app.use((e,req,res,next)=>res.status(400).json({error:/^[A-Z_]+$/.test(e.message)?e.message:'SELLER_REQUEST_FAILED'}));return app;
}
export class SellerClient {
  constructor({url,chain}){this.url=url;this.chain=chain;}
  async post(path,body,headers={}){const response=await fetch(this.url+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(12000)});const result=await response.json();if(!response.ok)throw new Error(result.error??'SELLER_HTTP_ERROR');return result;}
  quote(p,scenario){return this.post('/quote',{consent:p.consent,signature:p.signature,scenario});}
  async retrieve(p,{dropResponse=false}={}){const challenge=await this.post('/challenge',{owner:p.consent.owner,purchaseId:p.id});const signature=await this.chain.signer.signTypedData(this.chain.domain,ACCESS_TYPES,challenge);return this.post('/retrieve',{challenge,signature},dropResponse?{'x-demo-drop-response':'1'}:{});}
}
