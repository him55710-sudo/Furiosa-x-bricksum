import {AbiCoder,TypedDataEncoder,keccak256} from 'ethers';
import {hash,ensure} from '../deal-escrow/domain.ts';
import {verifyNegotiationPacket} from './ledger.mjs';

const fields=s=>s.split(',').map(x=>{const [type,name]=x.split(' ');return {name,type};});
export const types={
 Mandate:fields('address buyer,address agent,address evaluator,bytes32 sellersHash,uint256 budget,uint256 maxPerDeal,uint64 validUntil,uint256 nonce'),
 Deal:fields('bytes32 dealHash,bytes32 mandateId,address seller,uint256 amount,uint32 deliveryWindow,uint64 expiresAt,bytes32 termsHash,bytes32 previewHash'),
 Claim:fields('bytes32 dealHash,bytes32 claimId,address payee,uint256 amount,bytes32 deliveryHash'),
 Validation:fields('bytes32 dealHash,bytes32 claimHash,bytes32 evidenceHash'),
 Preview:fields('bytes32 dealHash,bytes32 previewHash')
};
export const vaultDomain=(chainId,address)=>({name:'DealTraceVault',version:'2',chainId,verifyingContract:address});
export const sellerListHash=sellers=>keccak256(AbiCoder.defaultAbiCoder().encode(['address[]'],[sellers]));
export const digest=(domain,type,body)=>TypedDataEncoder.hash(domain,{[type]:types[type]},body);
export const signTyped=(wallet,domain,type,body)=>wallet.signTypedData(domain,{[type]:types[type]},body);

// Existing immutable negotiation remains evidence; v2 requires fresh EVM signatures
// over this execution envelope. An Ed25519 conversation signature is NOT an EVM signature.
export function compileVaultDeal(packet,{mandateId,seller,unitWei,previewHash='0x'+'0'.repeat(64),domain}){
 const verified=verifyNegotiationPacket(packet);ensure(verified.verdict==='VALID','NEGOTIATION_NOT_VERIFIED');
 const deal=packet.revisions.at(-1).deal;
 ensure(deal.assurance&&deal.assurance.contract.toLowerCase()===domain.verifyingContract.toLowerCase()&&deal.assurance.chain_id===Number(domain.chainId)&&deal.assurance.payee===seller.toLowerCase()&&deal.assurance.unit_wei===String(unitWei),'VAULT_EXECUTION_BINDING');
 return {dealHash:hash(deal),mandateId,seller,amount:(BigInt(deal.price_minor)*BigInt(unitWei)).toString(),deliveryWindow:deal.deadline,expiresAt:deal.expires_at,termsHash:hash(packet),previewHash};
}
