import {keccak256,toUtf8Bytes,verifyMessage} from 'ethers';
// Same canonical, EIP-191 signed-packet format as DealTrace procurement, without
// loading its CAPEX catalog or chain adapters into the hosted enforcement API.
export function canonical(value){
 if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'){if(!Number.isFinite(value)||Object.is(value,-0))throw Error('NON_CANONICAL_NUMBER');return JSON.stringify(value);}
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)throw Error('NON_CANONICAL_VALUE');
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
export const hash=value=>keccak256(toUtf8Bytes(canonical(value)));
export async function signed(wallet,body){return {body:structuredClone(body),signature:await wallet.signMessage(hash(body))};}
export function verifySigned(packet,address){
 if(!packet?.body||typeof packet.signature!=='string'||typeof address!=='string'||verifyMessage(hash(packet.body),packet.signature).toLowerCase()!==address.toLowerCase())throw Error('SIGNATURE_INVALID');
 return packet.body;
}
