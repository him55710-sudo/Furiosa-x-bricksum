import {hash} from './domain.ts';
import type {Check,Requirements} from './domain.ts';
import {reference,referenceChecks,referenceDigest} from './reference.ts';
import {sourceChecks,sourceDescriptor,sourcePolicyHash} from './source-document.ts';
export type DeliveryVersion='delivery-v1'|'delivery-v2'|'delivery-reference-v1'|'delivery-source-v1'|'delivery-source-preview-v1';
export const DELIVERY_VALIDATOR_VERSION='delivery-v2';
// This is a syntax/quality gate. URLs are never fetched and values are not fact checked.
function safeSource(value:unknown){
  if(typeof value!=='string'||!value.trim()||value!==value.trim())return false;
  try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!!url.hostname&&!url.username&&!url.password&&!/[\u0000-\u0020\u007f]/.test(value);}catch{return false;}
}
export function validateDelivery(raw:string,requirements:Requirements,submittedAt:number,deadline:number,{version=requirements.source_document_id?'delivery-source-v1':requirements.reference_dataset_id?'delivery-reference-v1':DELIVERY_VALIDATOR_VERSION}:{version?:DeliveryVersion}={}){
  const sourceMode=version==='delivery-source-v1'||version==='delivery-source-preview-v1',sample=version==='delivery-source-preview-v1';
  if(requirements.source_document_id&&(!sourceMode||requirements.source_policy_hash!==sourcePolicyHash(requirements.source_document_id)))throw new Error('SOURCE_VALIDATOR_REQUIRED');
  if(sourceMode&&!requirements.source_document_id)throw new Error('SOURCE_DOCUMENT_REQUIRED');
  if(requirements.reference_dataset_id&&version!=='delivery-reference-v1')throw new Error('REFERENCE_VALIDATOR_REQUIRED');
  if(version==='delivery-reference-v1'&&!requirements.reference_dataset_id)throw new Error('REFERENCE_DATASET_REQUIRED');
  let rows:any[]=[],json=false;try{const parsed=JSON.parse(raw);json=Array.isArray(parsed);if(json)rows=parsed;}catch{}
  const columns=json&&rows.every(row=>row&&typeof row==='object'&&!Array.isArray(row)&&requirements.required_columns.every(k=>Object.hasOwn(row,k)));
  const sourced=rows.filter(row=>{if(version!=='delivery-v1')return safeSource(row?.source_url);try{const url=new URL(row?.source_url);return ['https:','http:'].includes(url.protocol);}catch{return false;}}).length;
  const coverage=rows.length?sourced/rows.length:0;
  const checks:Check[]=[
    {name:'VALID_JSON_ARRAY',pass:json,actual:json,expected:true},
    {name:'MINIMUM_ROWS',pass:rows.length>=(sample?1:requirements.minimum_rows),actual:rows.length,expected:sample?1:requirements.minimum_rows},
    {name:'REQUIRED_COLUMNS',pass:columns,actual:columns,expected:requirements.required_columns},
    {name:'SOURCE_URL_COVERAGE',pass:coverage>=requirements.minimum_source_coverage,actual:coverage,expected:requirements.minimum_source_coverage},
    {name:'DELIVERY_DEADLINE',pass:submittedAt<deadline,actual:submittedAt,expected:deadline},
  ];
  if(version!=='delivery-v1'){
    const text=(value:unknown)=>typeof value==='string'&&value.trim().length>0;
    const typed=columns&&rows.every(row=>text(row.company)&&text(row.quarter)&&text(row.currency)&&typeof row.capex==='number'&&Number.isFinite(row.capex)&&row.capex>=0&&typeof row.source_url==='string');
    const quarterPattern=sourceMode?new RegExp(`^${sourceDescriptor(requirements.source_document_id!).year}-Q[1-4]$`):/^202[56]-Q[1-4]$/;
    const quarters=columns&&rows.every(row=>typeof row.quarter==='string'&&quarterPattern.test(row.quarter));
    const currencies=columns&&rows.every(row=>typeof row.currency==='string'&&/^[A-Z]{3}$/.test(row.currency));
    // A company/quarter/currency is one economic observation; changing price or URL cannot pad it.
    const keys=typed?rows.map(row=>JSON.stringify([row.company.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase(),row.quarter,row.currency])):[];
    const unique=typed&&new Set(keys).size===rows.length;
    checks.push(
      {name:'CAPEX_VALUE_TYPES',pass:!!typed,actual:!!typed,expected:'nonempty company, quarter and currency; finite nonnegative numeric capex; string source_url'},
      {name:'CAPEX_QUARTER_RANGE',pass:!!quarters,actual:!!quarters,expected:sourceMode?'Approved source-document year, Q1 through Q4':'2025-Q1 through 2026-Q4'},
      {name:'CURRENCY_FORMAT',pass:!!currencies,actual:!!currencies,expected:'three uppercase letters; currency authenticity is not verified'},
      {name:'UNIQUE_ECONOMIC_ROWS',pass:!!unique,actual:new Set(keys).size,expected:rows.length},
    );
  }
  if(version==='delivery-reference-v1')checks.push(...referenceChecks(rows,requirements.reference_dataset_id!));
  const source=sourceMode?sourceChecks(rows,requirements.source_document_id!,sample):null;if(source)checks.push(...source.checks);
  return {...(version!=='delivery-v1'?{validator_version:version,url_validation_scope:sourceMode?'Original pinned PDF bytes and cited cell geometry; finite supported table grammar; issuer truth is not certified':version==='delivery-reference-v1'?'Exact pinned issuer document, page, row and annotated values; document not refetched at settlement':'HTTP(S) syntax only; no retrieval or factual verification'}:{}),...(source?{source_evidence:source.evidence}:{}),...(version==='delivery-reference-v1'?{reference_dataset_id:reference.id,reference_digest:referenceDigest,reference_annotation:reference.annotation}:{}),verified:checks.every(c=>c.pass),checks,failure_reason_code:checks.every(c=>c.pass)?null:'DELIVERY_REQUIREMENT_FAILED',evidence_hash:hash({raw,submitted_at:submittedAt,requirements,deadline}),content_hash:hash(raw),row_count:rows.length,source_count:sourced,source_coverage:coverage,submitted_at:submittedAt,deadline,semantic_truth_verified:false};
}
export function validatePreview(raw:string,requirements:Requirements,time:number,deadline:number,version?:DeliveryVersion){
 if(requirements.source_document_id)return validateDelivery(raw,requirements,time,deadline,{version:'delivery-source-preview-v1'});
 return validateDelivery(raw,{...requirements,minimum_rows:requirements.reference_dataset_id?Math.min(5,requirements.minimum_rows):5},time,deadline,version?{version}:{});
}
export function fixtureDelivery(rows=52){return JSON.stringify(Array.from({length:rows},(_,i)=>({company:`Demo Battery ${Math.floor(i/8)+1}`,quarter:`202${5+Math.floor((i%8)/4)}-Q${i%4+1}`,capex:100+i,currency:'KRW',source_url:i<Math.floor(rows*0.97)?`https://example.org/demo-source/${i}`:''})));}
