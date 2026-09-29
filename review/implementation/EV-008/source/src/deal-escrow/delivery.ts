import {hash} from './domain.ts';
import type {Check,Requirements} from './domain.ts';
export const DELIVERY_VALIDATOR_VERSION='delivery-v2';
// This is a syntax/quality gate. URLs are never fetched and values are not fact checked.
function safeSource(value:unknown){
  if(typeof value!=='string'||!value.trim()||value!==value.trim())return false;
  try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!!url.hostname&&!url.username&&!url.password&&!/[\u0000-\u0020\u007f]/.test(value);}catch{return false;}
}
export function validateDelivery(raw:string,requirements:Requirements,submittedAt:number,deadline:number,{version=DELIVERY_VALIDATOR_VERSION}:{version?:'delivery-v1'|'delivery-v2'}={}){
  let rows:any[]=[],json=false;try{const parsed=JSON.parse(raw);json=Array.isArray(parsed);if(json)rows=parsed;}catch{}
  const columns=json&&rows.every(row=>row&&typeof row==='object'&&!Array.isArray(row)&&requirements.required_columns.every(k=>Object.hasOwn(row,k)));
  const sourced=rows.filter(row=>{if(version===DELIVERY_VALIDATOR_VERSION)return safeSource(row?.source_url);try{const url=new URL(row?.source_url);return ['https:','http:'].includes(url.protocol);}catch{return false;}}).length;
  const coverage=rows.length?sourced/rows.length:0;
  const checks:Check[]=[
    {name:'VALID_JSON_ARRAY',pass:json,actual:json,expected:true},
    {name:'MINIMUM_ROWS',pass:rows.length>=requirements.minimum_rows,actual:rows.length,expected:requirements.minimum_rows},
    {name:'REQUIRED_COLUMNS',pass:columns,actual:columns,expected:requirements.required_columns},
    {name:'SOURCE_URL_COVERAGE',pass:coverage>=requirements.minimum_source_coverage,actual:coverage,expected:requirements.minimum_source_coverage},
    {name:'DELIVERY_DEADLINE',pass:submittedAt<deadline,actual:submittedAt,expected:deadline},
  ];
  if(version===DELIVERY_VALIDATOR_VERSION){
    const text=(value:unknown)=>typeof value==='string'&&value.trim().length>0;
    const typed=columns&&rows.every(row=>text(row.company)&&text(row.quarter)&&text(row.currency)&&typeof row.capex==='number'&&Number.isFinite(row.capex)&&row.capex>=0&&typeof row.source_url==='string');
    const quarters=columns&&rows.every(row=>typeof row.quarter==='string'&&/^202[56]-Q[1-4]$/.test(row.quarter));
    const currencies=columns&&rows.every(row=>typeof row.currency==='string'&&/^[A-Z]{3}$/.test(row.currency));
    // A company/quarter/currency is one economic observation; changing price or URL cannot pad it.
    const keys=typed?rows.map(row=>JSON.stringify([row.company.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase(),row.quarter,row.currency])):[];
    const unique=typed&&new Set(keys).size===rows.length;
    checks.push(
      {name:'CAPEX_VALUE_TYPES',pass:!!typed,actual:!!typed,expected:'nonempty company, quarter and currency; finite nonnegative numeric capex; string source_url'},
      {name:'CAPEX_QUARTER_RANGE',pass:!!quarters,actual:!!quarters,expected:'2025-Q1 through 2026-Q4'},
      {name:'CURRENCY_FORMAT',pass:!!currencies,actual:!!currencies,expected:'three uppercase letters; currency authenticity is not verified'},
      {name:'UNIQUE_ECONOMIC_ROWS',pass:!!unique,actual:new Set(keys).size,expected:rows.length},
    );
  }
  return {...(version===DELIVERY_VALIDATOR_VERSION?{validator_version:DELIVERY_VALIDATOR_VERSION,url_validation_scope:'HTTP(S) syntax only; no retrieval or factual verification'}:{}),verified:checks.every(c=>c.pass),checks,failure_reason_code:checks.every(c=>c.pass)?null:'DELIVERY_REQUIREMENT_FAILED',evidence_hash:hash({raw,submitted_at:submittedAt,requirements,deadline}),content_hash:hash(raw),row_count:rows.length,source_count:sourced,source_coverage:coverage,submitted_at:submittedAt,deadline,semantic_truth_verified:false};
}
export function fixtureDelivery(rows=52){return JSON.stringify(Array.from({length:rows},(_,i)=>({company:`Demo Battery ${Math.floor(i/8)+1}`,quarter:`202${5+Math.floor((i%8)/4)}-Q${i%4+1}`,capex:100+i,currency:'KRW',source_url:i<Math.floor(rows*0.97)?`https://example.org/demo-source/${i}`:''})));}
