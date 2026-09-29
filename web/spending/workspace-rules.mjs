import {columns,parseSource,normalizeRows} from './workspace-model.mjs';
export const requireValue=(ok,message)=>{if(!ok)throw Error(message);};
export const whole=(n,min=1,max=1000000)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
export function checkRows(job,rows,time=Math.floor(Date.now()/1000)){
 const typed=Array.isArray(rows)&&rows.every(r=>r&&typeof r==='object'&&!Array.isArray(r)&&columns.every(k=>Object.hasOwn(r,k)));
 const checks=[],add=(name,pass)=>checks.push({name,pass:!!pass});
 add('VALID_JSON_ARRAY',Array.isArray(rows));add('MINIMUM_ROWS',rows.length>=job.source.length);add('REQUIRED_COLUMNS',typed);
 const safeURL=value=>{if(typeof value!=='string'||/[\u0000-\u0020\u007f]/.test(value))return false;try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&u.hostname&&!u.username&&!u.password;}catch{return false;}};
 add('SOURCE_URL_COVERAGE',rows.length&&rows.every(r=>safeURL(r?.source_url)));
 add('DELIVERY_DEADLINE',time<(job.deadline??time+job.deliveryMinutes*60));
 add('CAPEX_VALUE_TYPES',typed&&rows.every(r=>typeof r.company==='string'&&r.company.trim()&&typeof r.capex==='number'&&Number.isFinite(r.capex)&&r.capex>=0));
 add('CAPEX_QUARTER_RANGE',typed&&rows.every(r=>typeof r.quarter==='string'&&/^202[56]-Q[1-4]$/.test(r.quarter)));
 add('CURRENCY_FORMAT',typed&&rows.every(r=>typeof r.currency==='string'&&/^[A-Z]{3}$/.test(r.currency)));
 const keys=rows.map(r=>JSON.stringify([String(r?.company??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase(),r?.quarter,r?.currency]));
 add('UNIQUE_ECONOMIC_ROWS',new Set(keys).size===rows.length);
 const expected=normalizeRows(job.source);
 add('SOURCE_VALUES_MATCH',rows.length===expected.length&&expected.every(a=>rows.some(b=>b&&Object.keys(a).every(k=>JSON.stringify(b[k])===JSON.stringify(a[k])))));
 return {verified:checks.every(c=>c.pass),checks,semantic_truth_verified:false};
}
export function taskSpec(input){
 requireValue(typeof input.title==='string'&&input.title.trim().length>=3&&input.title.length<=100,'Give this task a title between 3 and 100 characters.');
 requireValue(typeof input.brief==='string'&&input.brief.trim().length>=10&&input.brief.length<=4000,'Describe the required work in 10 to 4,000 characters.');
 requireValue(whole(input.budget)&&whole(input.perDeal,1,input.budget),'Use whole test-unit amounts. The per-deal limit cannot exceed the task budget.');
 requireValue(whole(input.deliveryMinutes,1,60),'Set a delivery window from 1 to 60 minutes.');
 const source=parseSource(input.sourceText);
 requireValue(checkRows({source,deliveryMinutes:input.deliveryMinutes},normalizeRows(source)).verified,'The source table has invalid values, duplicate rows or missing HTTP(S) citations. Use 2025–2026 quarters and three-letter currencies.');
 return {demoMode:input.demoMode===true,title:input.title.trim(),brief:input.brief.trim(),budget:input.budget,perDeal:input.perDeal,deliveryMinutes:input.deliveryMinutes,source,sourceName:String(input.sourceName??'Source table').slice(0,120)};
}
