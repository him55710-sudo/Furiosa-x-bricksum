// Engineering sensitivity analysis, not hardware telemetry or a measured bound.
export function energySensitivity(flows,{cards=4,assumedWattsPerCard=150}={}){
  if(!Number.isFinite(cards)||cards<=0||!Number.isFinite(assumedWattsPerCard)||assumedWattsPerCard<=0)throw new Error('INVALID_POWER_ASSUMPTION');
  if(!Array.isArray(flows)||flows.some(f=>!Number.isFinite(f.latency_ms)||f.latency_ms<0||!Number.isSafeInteger(f.calls)||f.calls<1))throw new Error('INVALID_FLOW_MEASUREMENT');
  const scenarios=[
    {id:'short-active',label:'짧은 활성 시간 가정',active_fraction:.25,power_fraction:.5},
    {id:'middle',label:'중간 가정',active_fraction:.5,power_fraction:.75},
    {id:'exclusive-nameplate',label:'전체 지연·명목 전력 가정',active_fraction:1,power_fraction:1},
  ];
  return scenarios.map(s=>{
    const calculated=flows.map(f=>({flow_name:f.flow_name,calls:f.calls,observed_latency_ms:f.latency_ms,assumed_active_seconds:f.latency_ms/1000*s.active_fraction,joules:Number((cards*assumedWattsPerCard*s.power_fraction*f.latency_ms/1000*s.active_fraction).toFixed(3))}));
    const joules=calculated.reduce((n,f)=>n+f.joules,0);
    return {...s,assumed_accelerator_watts:cards*assumedWattsPerCard*s.power_fraction,flows:calculated,joules:Number(joules.toFixed(3)),watt_hours:Number((joules/3600).toFixed(6))};
  });
}
