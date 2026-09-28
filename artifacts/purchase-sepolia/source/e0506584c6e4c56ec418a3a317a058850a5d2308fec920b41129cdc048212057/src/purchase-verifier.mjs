import {Contract,TypedDataEncoder,verifyTypedData,keccak256} from 'ethers';
import {CONSENT_TYPES,QUOTE_TYPES,hash,sameAddress,merchantsHash,purchaseKey,validateQuote,validateDelivery} from '../shared/purchase.mjs';
export async function verifyPurchaseBundle(bundle,{provider,deployment,artifact}={}){
  const checks=[],check=(name,condition)=>{checks.push({name,ok:!!condition});if(!condition)throw new Error(name);};
  const incomplete=reason=>({status:'INCOMPLETE',reason,checks});
  if(!bundle?.purchase||bundle.schemaVersion!==3)return incomplete('PURCHASE_BUNDLE_REQUIRED');
  if(!provider||!deployment||!artifact)return incomplete('INDEPENDENT_CHAIN_AND_MANIFEST_REQUIRED');
  const p=bundle.purchase,c=p.consent;
  if(!c||!p.signature||!p.merchants||!p.resource)return incomplete('APPROVAL_EVIDENCE_MISSING');
  const domain={name:'ControlMemoryPurchase',version:'3',chainId:deployment.chainId,verifyingContract:deployment.vault};
  try{
    check('DOMAIN',hash(domain)===hash(bundle.domain));
    check('CHAIN_ID',(await provider.getNetwork()).chainId===BigInt(deployment.chainId));
    check('DEPLOYMENT_CODE',keccak256(await provider.getCode(deployment.vault))===deployment.vaultCodeHash&&keccak256(await provider.getCode(deployment.token))===deployment.tokenCodeHash);
    check('CONSENT_SCHEMA',Object.keys(c).sort().join()===CONSENT_TYPES.Consent.map(f=>f.name).sort().join());
    check('ONE_PURCHASE',c.maxSettlements==='1'&&p.id===c.purchaseId);
    check('OWNER_SIGNATURE',sameAddress(verifyTypedData(domain,CONSENT_TYPES,c,p.signature),c.owner));
    check('MERCHANT_LIST',merchantsHash(p.merchants)===c.merchantsHash);
    check('RESOURCE_SPEC',hash(p.resource)===c.resourceSpecHash);
    const vault=new Contract(deployment.vault,artifact.abi,provider),key=purchaseKey(domain,c.owner,p.id);
    const observed=await provider.getBlock('latest');if(!observed)return incomplete('BLOCK_UNAVAILABLE');
    const approved=await provider.getLogs({address:deployment.vault,fromBlock:deployment.deployBlock,toBlock:observed.number,topics:[vault.interface.getEvent('PurchaseApproved').topicHash,key]});
    check('ONCHAIN_APPROVAL',approved.length===1&&vault.interface.parseLog(approved[0]).args.consentDigest===TypedDataEncoder.hash(domain,CONSENT_TYPES,c));
    const payments=await provider.getLogs({address:deployment.vault,fromBlock:deployment.deployBlock,toBlock:observed.number,topics:[vault.interface.getEvent('PurchaseSettled').topicHash,key]});
    check('PAYMENT_COUNT',payments.length<=1);
    if(!payments.length){
      if(p.payment==='SETTLED'||p.receipt)return incomplete('CLAIMED_PAYMENT_NOT_OBSERVED');
      return {status:'VALID',scope:'APPROVAL_AND_NO_PAYMENT_AT_OBSERVED_BLOCK',checks,paymentCount:0,observedBlock:{number:observed.number,hash:observed.hash},delivery:'NOT_VERIFIED',limitations:['Off-chain stop reasons and result non-delivery are not proven by absence of a payment event.']};
    }
    if(!bundle.preEvidence||!p.quote||!p.receipt)return incomplete('PAYMENT_EVIDENCE_MISSING');
    const pre=bundle.preEvidence,event=vault.interface.parseLog(payments[0]);
    const receipt=await provider.getTransactionReceipt(payments[0].transactionHash);if(!receipt)return incomplete('PAYMENT_RECEIPT_UNAVAILABLE');
    const block=await provider.getBlock(receipt.blockNumber);if(!block)return incomplete('PAYMENT_BLOCK_UNAVAILABLE');
    check('TRANSACTION_RECEIPT',receipt.status===1&&receipt.hash===p.receipt.hash&&receipt.blockHash===p.receipt.blockHash&&block.hash===receipt.blockHash);
    check('EVIDENCE_ANCHOR',hash(pre)===event.args.evidenceHash&&p.evidenceHash===event.args.evidenceHash);
    for(const name of ['consent','signature','merchants','resource','question','quote','assessment'])check('BOUND_'+name.toUpperCase(),hash(pre[name])===hash(p[name]));
    check('PRE_EVIDENCE_DOMAIN',hash(pre.domain)===hash(domain));
    validateQuote(p,p.quote,domain,block.timestamp);checks.push({name:'SIGNED_QUOTE_AND_LIMITS',ok:true});
    check('PAYMENT_BINDING',event.args.purchaseId===p.id&&event.args.resourceSpecHash===c.resourceSpecHash&&event.args.offerDigest===TypedDataEncoder.hash(domain,QUOTE_TYPES,p.quote.quote)&&event.args.amount.toString()===p.quote.quote.total&&sameAddress(event.args.merchant,p.quote.quote.merchant));
    const tx=await provider.getTransaction(receipt.hash);if(!tx)return incomplete('PAYMENT_TRANSACTION_UNAVAILABLE');
    const call=vault.interface.parseTransaction({data:tx.data,value:tx.value});
    check('EXECUTION_CALL',call?.name==='pay'&&sameAddress(tx.from,deployment.executor)&&call.args.evidenceHash===event.args.evidenceHash);
    const token=new Contract(deployment.token,['event Transfer(address indexed from,address indexed to,uint256 value)'],provider);
    const transfers=receipt.logs.filter(l=>sameAddress(l.address,deployment.token)).map(l=>{try{return token.interface.parseLog(l);}catch{return null;}}).filter(l=>l?.name==='Transfer'&&sameAddress(l.args.from,deployment.vault)&&sameAddress(l.args.to,p.quote.quote.merchant));
    check('TOKEN_TRANSFER',transfers.length===1&&transfers[0].args.value===event.args.amount);
    check('CONTRACT_LATCH',await vault.settled(key,{blockTag:observed.number})&&await vault.spent(key,{blockTag:observed.number})===event.args.amount);
    if(!bundle.events||!pre.events)return incomplete('EVENT_HISTORY_MISSING');
    let prev=null;
    for(let i=0;i<bundle.events.length;i++){const {hash:claimed,...eventBody}=bundle.events[i];check('EVENT_'+(i+1),eventBody.seq===i+1&&eventBody.sessionId===p.id&&eventBody.prevHash===prev&&hash(eventBody)===claimed);prev=claimed;}
    check('ANCHORED_EVENT_PREFIX',hash(bundle.events.slice(0,pre.events.length))===hash(pre.events));
    let delivery='NOT_VERIFIED';
    if(p.result){validateDelivery(p,p.result,domain,event.args.merchant,receipt.hash);delivery='SIGNED_CONTENT_MATCH';checks.push({name:'SIGNED_DELIVERY_AND_CONTENT',ok:true});}
    else if(p.delivery==='RECEIVED_VALID'||p.workflow==='COMPLETE')return incomplete('DELIVERY_BYTES_MISSING');
    if(deployment.chainId!==31337){let finalized;try{finalized=await provider.getBlock('finalized');}catch{}if(!finalized||finalized.number<receipt.blockNumber)return incomplete('FINALITY_PENDING');}
    return {status:'VALID',scope:'PURCHASE_AUTHORITY_AND_PAYMENT',checks,paymentCount:1,amount:event.args.amount.toString(),txHash:receipt.hash,delivery,answer:'NOT_INDEPENDENTLY_VERIFIED',observedBlock:{number:observed.number,hash:observed.hash},limitations:['Post-payment logs and model telemetry are not independently attested.','Delivery signature and bytes do not establish factual correctness or prove non-delivery.']};
  }catch(e){if(checks.at(-1)?.ok!==false&&!/^[A-Z_0-9]+$/.test(e.message??''))return incomplete('CHAIN_OR_EVIDENCE_UNAVAILABLE');return {status:'INVALID',reason:e.message,checks};}
}
