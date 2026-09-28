import solc from 'solc';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const source=readFileSync('contracts/ControlMemory.sol','utf8');
const settings={optimizer:{enabled:true,runs:200},viaIR:true,evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','evm.deployedBytecode.immutableReferences']}}};
const input={language:'Solidity',sources:{'ControlMemory.sol':{content:source}},settings};
const output=JSON.parse(solc.compile(JSON.stringify(input),{import:p=>{
  if(!p.startsWith('@openzeppelin/contracts/')||p.includes('..'))return {error:'Import not allowed'};
  return {contents:readFileSync(path.join('node_modules',p),'utf8')};
}}));
const errors=output.errors?.filter(e=>e.severity==='error')??[];
if(errors.length)throw new Error(errors.map(e=>e.formattedMessage).join('\n'));
mkdirSync('artifacts/contracts',{recursive:true});
for(const name of ['TestCredit','BudgetVault']){
  const c=output.contracts['ControlMemory.sol'][name];
  writeFileSync(`artifacts/contracts/${name}.json`,JSON.stringify({contractName:name,compiler:solc.version(),settings,sourceSha256:createHash('sha256').update(source).digest('hex'),abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,runtimeTemplate:'0x'+c.evm.deployedBytecode.object,immutableReferences:c.evm.deployedBytecode.immutableReferences},null,2)+'\n');
}
console.log('Compiled TestCredit and BudgetVault (Solidity 0.8.30, Shanghai, optimizer 200, viaIR).');
