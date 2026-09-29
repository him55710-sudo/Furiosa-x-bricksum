// Standalone read-only financial verifier. It does not load application modules or its database.
import {readFileSync,writeFileSync} from 'node:fs';import {JsonRpcProvider,Contract,Interface,keccak256} from 'ethers';
const [packetFile,refundFile,outFile]=process.argv.slice(2);const packet=JSON.parse(readFileSync(packetFile,'utf8')),refund=JSON.parse(readFileSync(refundFile,'utf8'));
const provider=new JsonRpcProvider(packet.rpc_url,undefined,{cacheTimeout:-1});const same=(a,b)=>a?.toLowerCase()===b?.toLowerCase();
const check=(pass,reason)=>{if(!pass)throw new Error(reason);};
try{
  check([31338,11155111].includes(packet.chain_id)&&Number((await provider.getNetwork()).chainId)===packet.chain_id,'CHAIN_MISMATCH');check(keccak256(await provider.getCode(packet.contract))===packet.runtime_hash,'CODE_MISMATCH');
  const abi=['function controller() view returns(address)','function escrows(bytes32) view returns(address buyer,address seller,uint256 amount,uint64 deadline,uint8 status)','event Funded(bytes32 indexed dealHash,address indexed buyer,address indexed seller,uint256 amount,uint64 deadline)','event Refunded(bytes32 indexed dealHash,bytes32 reasonHash,uint256 amount)'];
  const contract=new Contract(packet.contract,abi,provider),iface=new Interface(abi),escrow=await contract.escrows(packet.deal_hash);
  check(same(await contract.controller(),packet.controller)&&!same(packet.controller,packet.buyer),'BUYER_CONTROLLER_NOT_SEPARATE');
  const fund=await provider.getTransactionReceipt(packet.fund_tx),paidBack=await provider.getTransactionReceipt(refund.tx_hash);
  const mode=process.argv.includes('--finalized')?'finalized':'confirmations',head=await provider.getBlock(mode==='finalized'?'finalized':'latest'),required=packet.chain_id===11155111?2:1;
  for(const tx of [fund,paidBack]){check(tx?.status===1&&same(tx.to,packet.contract),'RECEIPT_INVALID');check((await provider.getBlock(tx.blockNumber)).hash===tx.blockHash,'NONCANONICAL_RECEIPT');check(head&&head.number-tx.blockNumber+1>=(mode==='finalized'?1:required),'FINALITY_PENDING');}
  const event=(receipt,name)=>receipt.logs.filter(l=>same(l.address,packet.contract)).map(l=>{try{return iface.parseLog(l);}catch{return null;}}).find(l=>l?.name===name);
  const funded=event(fund,'Funded'),returned=event(paidBack,'Refunded');
  check(funded?.args.dealHash===packet.deal_hash&&returned?.args.dealHash===packet.deal_hash,'DEAL_BINDING_MISMATCH');
  check(same(fund.from,packet.controller)&&same(paidBack.from,packet.buyer)&&same(funded.args.buyer,packet.buyer)&&same(escrow.buyer,packet.buyer),'ACTOR_MISMATCH');
  check(funded.args.amount.toString()===packet.amount_wei&&returned.args.amount===funded.args.amount&&escrow.amount===funded.args.amount,'EXACT_AMOUNT_MISMATCH');
  check(escrow.status===3n&&(await provider.getBlock(paidBack.blockNumber)).timestamp>=Number(funded.args.deadline),'REFUND_DEADLINE_MISMATCH');
  const result={verdict:'VALID',scope:'Canonical test-chain funding and buyer-signed deadline refund for the pinned contract; no off-chain content truth claim',finality_mode:mode,observed_block:head.number,required_confirmations:required,app_server_access:false,app_database_access:false,controller_key_access:false,chain_id:packet.chain_id,deal_hash:packet.deal_hash,fund_tx:fund.hash,refund_tx:paidBack.hash,buyer:packet.buyer,amount_wei:packet.amount_wei};writeFileSync(outFile,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{provider.destroy();}
