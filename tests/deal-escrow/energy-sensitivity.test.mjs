import test from 'node:test';import assert from 'node:assert/strict';
import {energySensitivity} from '../../src/deal-escrow/energy-sensitivity.mjs';
test('energy assumptions are applied independently by flow without treating API latency as measured active time',()=>{
  const result=energySensitivity([{flow_name:'buyer',calls:1,latency_ms:1000},{flow_name:'seller',calls:1,latency_ms:3000}]);
  assert.deepEqual(result.map(r=>r.joules),[300,900,2400]);
  assert.equal(result[0].flows[0].assumed_active_seconds,.25);assert.equal(result[1].flows[1].joules,675);
  assert.throws(()=>energySensitivity([{flow_name:'missing',calls:1,latency_ms:null}]),/INVALID_FLOW_MEASUREMENT/);
  assert.throws(()=>energySensitivity([],{cards:0}),/INVALID_POWER_ASSUMPTION/);
});
