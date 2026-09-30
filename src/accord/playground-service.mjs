import {createLiveService} from './live-service.mjs';
import {createPlaygroundAgents,verifyPlaygroundEvidence} from './playground-agents.mjs';
export function createPlaygroundService({store,secret,model=process.env.KILN_MODEL,callBudget=60,now=Date.now,clientFactory}={}) {
 const service=createLiveService({store,callBudget,now,sessionLimit:24,
  inferenceActions:['offer','counter','respond','select','invoice'],
  allowedActions:['start','offer','counter','respond','select','agree','invoice','enforce','settle','stop'],
  negotiation:createPlaygroundAgents({secret,model,now,clientFactory})});
 const evidence=r=>r.session?{...r,verification:verifyPlaygroundEvidence(r.session)}:r;
 return {state:async(...args)=>evidence(await service.state(...args)),execute:async(...args)=>evidence(await service.execute(...args))};
}
