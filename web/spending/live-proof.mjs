import {getBytes,verifyMessage,keccak256,toUtf8Bytes} from 'ethers';
export const liveDigest=value=>keccak256(toUtf8Bytes(JSON.stringify(value)));
export const liveBrief=job=>({title:job.title,brief:job.brief,budget:job.budget,perDeal:job.perDeal,rows:job.source.length,sources:new Set(job.source.map(row=>row.source_url)).size,deliveryMinutes:job.deliveryMinutes,sourceHash:liveDigest(job.source)});
export function checkLiveAgreement(job,session){
 const need=(ok,message)=>{if(!ok)throw Error(message);};
 const a=session?.agreement;need(a,'Live agreement is not signed.');
 const {hash,buyerSignature,sellerSignature,...body}=a;
 need(liveDigest(body)===hash,'Live agreement hash changed.');
 need(verifyMessage(getBytes(hash),buyerSignature)===a.buyer&&verifyMessage(getBytes(hash),sellerSignature)===a.seller,'Live agreement signatures are invalid.');
 need(a.buyer===session.identities.buyer.address&&a.seller===session.identities[a.sellerId]?.address,'Live signer identity changed.');
 need(a.requestHash===liveDigest(session.request)&&a.sourceHash===liveDigest(job.source),'Live source commitment changed.');
 need(liveDigest(session.request)===liveDigest(liveBrief(job)),'Live mandate changed. Start a new negotiation.');
 need(a.terms.price<=Math.min(job.budget,job.perDeal)&&a.terms.rows===job.source.length&&a.terms.sources>=session.request.sources&&a.terms.deliveryMinutes<=job.deliveryMinutes,'Live terms exceed the mandate.');
 need(a.session===session.id&&a.expiresAt===session.expiresAt,'Live session binding changed.');
 const messages=session.messages.filter(m=>m.seller===a.sellerId);
 need(a.transcriptHash===liveDigest(messages.map(m=>({signature:m.signature,quote:m.quote,requestId:m.requestId}))),'Live transcript changed.');
 return a;
}
