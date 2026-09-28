import solc from 'solc';import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const source=readFileSync('contracts/AgentDealEscrow.sol','utf8');
const settings={optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}};
const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'AgentDealEscrow.sol':{content:source}},settings})));
const errors=(output.errors??[]).filter(x=>x.severity==='error');if(errors.length)throw new Error(errors.map(x=>x.formattedMessage).join('\n'));
const c=output.contracts['AgentDealEscrow.sol'].AgentDealEscrow;
mkdirSync('artifacts/deal-escrow',{recursive:true});writeFileSync('artifacts/deal-escrow/contract.json',JSON.stringify({contractName:'AgentDealEscrow',compiler:solc.version(),settings,sourceSha256:createHash('sha256').update(source).digest('hex'),abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,runtimeTemplate:'0x'+c.evm.deployedBytecode.object},null,2)+'\n');console.log('Compiled AgentDealEscrow');
