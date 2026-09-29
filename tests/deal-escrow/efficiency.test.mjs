import test from 'node:test';
import assert from 'node:assert/strict';
import {efficiency} from '../../src/dealtrace/efficiency.mjs';

test('inference accounting includes malformed paid responses and attempts without usage',()=>{
 const records=[
  {flow_name:'interpret',result:'VALID_TOOL_PROPOSAL',prompt_tokens:100,completion_tokens:20,total_tokens:120,latency_ms:500},
  {flow_name:'interpret',result:'KILN_INVALID_TOOL',prompt_tokens:100,completion_tokens:30,total_tokens:130,latency_ms:600},
  {flow_name:'interpret',result:'NETWORK_ERROR',total_tokens:null,latency_ms:900},
  {flow_name:'speak',result:'VALID_TOOL_PROPOSAL',total_tokens:40,latency_ms:100},
 ];
 const report=efficiency(records);
 assert.equal(report.total_calls,4);assert.equal(report.total_tokens,290);
 assert.equal(report.flows.interpret.failed_calls,2);assert.equal(report.flows.interpret.total_tokens,250);
 assert.equal(report.flows.speak.failed_calls,0);assert.equal(report.energy.measured,false);
});
