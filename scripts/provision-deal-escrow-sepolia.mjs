// Transfer existing, freely obtained Sepolia test ETH between our demo wallets.
// The signed intent is saved before broadcast, so a lost response cannot pay twice.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {Wallet,JsonRpcProvider,keccak256,parseEther,Transaction} from 'ethers';
const dir='data/private/deal-escrow/sepolia',journal=`${dir}/test-funding.json`;
const output='artifacts/deal-escrow/sepolia/test-funding.json';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
mkdirSync('artifacts/deal-escrow/sepolia',{recursive:true});
const provider=new JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com',undefined,{cacheTimeout:-1});
try {
  if((await provider.getNetwork()).chainId!==11155111n)throw new Error('SEPOLIA_ONLY');
  const from=new Wallet(read('data/private/purchase-sepolia/identities.json').executor,provider);
  const to=new Wallet(read(`${dir}/identities.json`).controller).address;
  if(from.address!=='0x6E4DE4126F057A9334c3fBDD0dd9e26c40534327'||to!=='0xE3e6E3451Ef871546a08339F0da42A2C07a5a2A9')throw new Error('DEMO_WALLET_MISMATCH');
  let intent=existsSync(journal)?read(journal):null;
  if(!intent){
    const nonce=await provider.getTransactionCount(from.address);
    if(nonce!==await provider.getTransactionCount(from.address,'pending'))throw new Error('SOURCE_HAS_PENDING_TRANSACTION');
    const request=await from.populateTransaction({to,value:parseEther('0.01'),nonce});
    const raw=await from.signTransaction(request);intent={txHash:keccak256(raw),raw};
    writeFileSync(journal,JSON.stringify(intent),{flag:'wx',mode:0o600});
  }
  const tx=Transaction.from(intent.raw);
  if(tx.hash!==intent.txHash||tx.from!==from.address||tx.to!==to||tx.chainId!==11155111n||tx.value!==parseEther('0.01'))throw new Error('SIGNED_INTENT_MISMATCH');
  let receipt=await provider.getTransactionReceipt(intent.txHash);
  if(!receipt){if(!await provider.getTransaction(intent.txHash))await provider.broadcastTransaction(intent.raw);receipt=await provider.waitForTransaction(intent.txHash,2,120000);}
  if(!receipt||receipt.status!==1)throw new Error('FUNDING_UNCONFIRMED');
  const report={network:'sepolia',chain_id:11155111,source:from.address,destination:to,test_eth:'0.01',transaction_hash:receipt.hash,block_number:receipt.blockNumber,block_hash:receipt.blockHash,source_note:'Previously acquired free Sepolia faucet assets; no purchase or new faucet request.'};
  writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
} finally {provider.destroy();}
