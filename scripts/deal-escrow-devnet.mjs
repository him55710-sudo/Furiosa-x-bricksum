import ganache from 'ganache';import {readFileSync,writeFileSync} from 'node:fs';import path from 'node:path';
const directory=process.argv[2];if(!directory)throw new Error('DIRECTORY_REQUIRED');
const identities=JSON.parse(readFileSync(path.join(directory,'identities.json'),'utf8'));
const server=ganache.server({logging:{quiet:true},chain:{chainId:31338,hardfork:'shanghai'},miner:{blockTime:1},wallet:{accounts:Object.values(identities).map(secretKey=>({secretKey,balance:'0x8AC7230489E80000'}))},database:{dbPath:path.join(directory,'independent-chain')}});
await server.listen(0,'127.0.0.1');const url=`http://127.0.0.1:${server.address().port}`;writeFileSync(path.join(directory,'rpc.json'),JSON.stringify({url,pid:process.pid}));console.log(JSON.stringify({status:'DEVNET_READY',url,pid:process.pid}));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await server.close();process.exit(0);});
