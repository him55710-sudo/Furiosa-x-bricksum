// Independent buyer tool: no app server, SQLite, model, controller key or engine import.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';import path from 'node:path';import {Wallet,JsonRpcProvider,FetchRequest,Contract,id,keccak256,Transaction} from 'ethers';
const [packetFile,buyerKeyFile,outFile]=process.argv.slice(2);if(!packetFile||!buyerKeyFile||!outFile)throw new Error('PACKET_BUYER_KEY_OUTPUT_REQUIRED');
const packet=JSON.parse(readFileSync(packetFile,'utf8')),url=new URL(packet.rpc_url),publicTest=packet.chain_id===11155111;
if(url.username||url.password||url.search||url.hash||(publicTest?url.protocol!=='https:'||!['ethereum-sepolia-rpc.publicnode.com','sepolia.gateway.tenderly.co'].includes(url.hostname):packet.chain_id!==31338||url.protocol!=='http:'||url.hostname!=='127.0.0.1'))throw new Error('TEST_NETWORK_ONLY');
const connection=new FetchRequest(url.href);connection.timeout=15000;
const provider=new JsonRpcProvider(connection,undefined,{cacheTimeout:-1});provider.pollingInterval=publicTest?2000:50;
try{
  if(Number((await provider.getNetwork()).chainId)!==packet.chain_id)throw new Error('CHAIN_MISMATCH');
  const buyer=new Wallet(JSON.parse(readFileSync(buyerKeyFile,'utf8')).private_key,provider);if(buyer.address.toLowerCase()!==packet.buyer.toLowerCase()||buyer.address.toLowerCase()===packet.controller.toLowerCase())throw new Error('INDEPENDENT_BUYER_REQUIRED');
  if(keccak256(await provider.getCode(packet.contract))!==packet.runtime_hash)throw new Error('CONTRACT_CODE_MISMATCH');
  const contract=new Contract(packet.contract,['function escrows(bytes32) view returns(address buyer,address seller,uint256 amount,uint64 deadline,uint8 status)','function refund(bytes32,bytes32)'],buyer);
  const escrow=await contract.escrows(packet.deal_hash),block=await provider.getBlock('latest'),intentFile=path.join(path.dirname(buyerKeyFile),'refund-'+packet.deal_hash+'.intent.json');let intent=existsSync(intentFile)?JSON.parse(readFileSync(intentFile,'utf8')):null;
  if(!intent){
    if(escrow.status!==1n||block.timestamp<Number(escrow.deadline)||escrow.buyer.toLowerCase()!==buyer.address.toLowerCase()||escrow.amount.toString()!==packet.amount_wei)throw new Error('REFUND_NOT_AVAILABLE');
    const before=await provider.getBalance(buyer.address),request=await buyer.populateTransaction(await contract.refund.populateTransaction(packet.deal_hash,id('BUYER_DIRECT_DEADLINE_REFUND'))),raw=await buyer.signTransaction(request);
    intent={raw,tx_hash:keccak256(raw),balance_before:before.toString(),amount_wei:escrow.amount.toString()};writeFileSync(intentFile,JSON.stringify(intent),{flag:'wx',mode:0o600});
  }
  const signed=Transaction.from(intent.raw),expected=contract.interface.encodeFunctionData('refund',[packet.deal_hash,id('BUYER_DIRECT_DEADLINE_REFUND')]);
  if(signed.hash!==intent.tx_hash||signed.from?.toLowerCase()!==buyer.address.toLowerCase()||signed.to?.toLowerCase()!==packet.contract.toLowerCase()||Number(signed.chainId)!==packet.chain_id||signed.data!==expected||signed.value!==0n||intent.amount_wei!==packet.amount_wei)throw new Error('SIGNED_INTENT_MISMATCH');
  // Reuse the identical signed intent after an uncertain broadcast. An independent
  // read RPC need not be the submission endpoint; neither path needs the app.
  if(!await provider.getTransaction(intent.tx_hash)){
    const submission=new FetchRequest(publicTest?'https://ethereum-sepolia-rpc.publicnode.com':url.href);submission.timeout=15000;
    const broadcaster=new JsonRpcProvider(submission,undefined,{cacheTimeout:-1});
    try{await broadcaster.broadcastTransaction(intent.raw);}finally{broadcaster.destroy();}
  }
  const receipt=await provider.waitForTransaction(intent.tx_hash,publicTest?2:1,45000);if(!receipt)throw new Error('REFUND_CONFIRMATION_PENDING');
  const before=BigInt(intent.balance_before),after=await provider.getBalance(buyer.address,receipt.blockNumber),fee=receipt.fee;
  if(receipt.status!==1||after-before+fee!==escrow.amount)throw new Error('BUYER_REFUND_BALANCE_MISMATCH');
  const result={status:'REFUNDED',buyer:buyer.address,tx_hash:intent.tx_hash,amount_wei:escrow.amount.toString(),balance_before:before.toString(),balance_after:after.toString(),gas_fee_wei:fee.toString(),app_access:false,controller_key_used:false};writeFileSync(outFile,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{provider.destroy();}
