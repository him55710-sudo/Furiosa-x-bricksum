import {keccak256, toUtf8Bytes} from 'ethers';
import {sourcePolicyHash} from './source-catalog.mjs';

export type Requirements = {minimum_rows:number; required_columns:string[]; minimum_source_coverage:number; format:'JSON';reference_dataset_id?:string;source_document_id?:string;source_policy_hash?:string};
export type TaskRequirements = Requirements & {version:1;max_delivery_seconds:number};
export type Deal = {deal_id:string; buyer_id:string; seller_id:string; price_minor:number; currency_or_demo_asset:'DEMO'; deliverable_type:'CAPEX_DATASET'; requirements:Requirements; deadline:number; created_at:number; expires_at:number; supersedes_deal_id:string|null};
export type Mandate = {mandate_id:string; company_id:string; buyer_id:string; task_budget_minor:number; max_single_minor:number; allowed_sellers:string[]; category:'RESEARCH_DATA'; status:'ACTIVE'|'REVOKED'; created_at:number; expires_at:number;task_requirements?:TaskRequirements};
export type State = 'NEGOTIATING'|'DEAL_PROPOSED'|'DEAL_ACCEPTED'|'PREVIEW_REQUIRED'|'PREVIEW_VERIFIED'|'POLICY_APPROVED'|'ESCROW_FUNDED'|'DELIVERY_SUBMITTED'|'DELIVERY_VERIFIED'|'SETTLED'|'REJECTED'|'BLOCKED'|'REFUNDED'|'EXPIRED';
export class Fault extends Error { code:string; constructor(code:string){super(code);this.code=code;} }
export function ensure(condition:unknown, code:string):asserts condition {if(!condition)throw new Fault(code);}
export function canonical(v:unknown):string {
  if(v===null||typeof v==='boolean'||typeof v==='string')return JSON.stringify(v);
  if(typeof v==='number'){ensure(Number.isFinite(v)&&!Object.is(v,-0),'NON_CANONICAL_NUMBER');return JSON.stringify(v);}
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  ensure(typeof v==='object'&&v!==null&&Object.getPrototypeOf(v)===Object.prototype,'NON_CANONICAL_VALUE');
  return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}';
}
export const hash=(v:unknown)=>keccak256(toUtf8Bytes(canonical(v)));
export const now=()=>Math.floor(Date.now()/1000);
export function exact(v:any,keys:string[]){ensure(v&&typeof v==='object'&&!Array.isArray(v),'SCHEMA_OBJECT');ensure(Object.keys(v).sort().join('|')===[...keys].sort().join('|'),'SCHEMA_FIELDS');}
export function integer(v:unknown,min:number,max:number){ensure(Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max,'SCHEMA_INTEGER');}
export function identifier(v:unknown){ensure(typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/.test(v),'SCHEMA_ID');}
export function validateRequirements(r:any):Requirements {
  exact(r,['minimum_rows','required_columns','minimum_source_coverage','format',...(Object.hasOwn(r??{},'reference_dataset_id')?['reference_dataset_id']:[]),...(Object.hasOwn(r??{},'source_document_id')?['source_document_id','source_policy_hash']:[])]);integer(r.minimum_rows,1,10000);
  if(Object.hasOwn(r,'reference_dataset_id'))ensure(r.reference_dataset_id==='lges-2025-v1','UNKNOWN_REFERENCE_DATASET');
  if(Object.hasOwn(r,'source_document_id')){ensure(!r.reference_dataset_id,'CONFLICTING_SOURCE_PROFILES');identifier(r.source_document_id);ensure(r.source_policy_hash===sourcePolicyHash(r.source_document_id),'SOURCE_POLICY_HASH_MISMATCH');}
  ensure(Array.isArray(r.required_columns)&&r.required_columns.length>0&&r.required_columns.length<=30,'SCHEMA_COLUMNS');
  r.required_columns.forEach(identifier);ensure(new Set(r.required_columns).size===r.required_columns.length,'DUPLICATE_COLUMN');
  ensure(['company','quarter','capex','currency','source_url'].every(k=>r.required_columns.includes(k)),'REQUIRED_CAPEX_COLUMNS');
  ensure(typeof r.minimum_source_coverage==='number'&&Number.isFinite(r.minimum_source_coverage)&&r.minimum_source_coverage>=0&&r.minimum_source_coverage<=1,'SCHEMA_COVERAGE');
  ensure(r.format==='JSON','SCHEMA_FORMAT');return structuredClone(r);
}
export function validateDeal(d:any):Deal {
  exact(d,['deal_id','buyer_id','seller_id','price_minor','currency_or_demo_asset','deliverable_type','requirements','deadline','created_at','expires_at','supersedes_deal_id']);
  [d.deal_id,d.buyer_id,d.seller_id].forEach(identifier);integer(d.price_minor,1,1_000_000_000);ensure(d.currency_or_demo_asset==='DEMO'&&d.deliverable_type==='CAPEX_DATASET','SCHEMA_PRODUCT');
  validateRequirements(d.requirements);integer(d.deadline,1,3600);integer(d.created_at,0,9_000_000_000);integer(d.expires_at,d.created_at+1,9_000_000_000);
  if(d.supersedes_deal_id!==null){identifier(d.supersedes_deal_id);ensure(d.supersedes_deal_id!==d.deal_id,'SELF_SUPERSESSION');}
  return structuredClone(d);
}
export function validateMandate(m:any):Mandate {
  exact(m,['mandate_id','company_id','buyer_id','task_budget_minor','max_single_minor','allowed_sellers','category','status','created_at','expires_at',...(Object.hasOwn(m??{},'task_requirements')?['task_requirements']:[])]);
  [m.mandate_id,m.company_id,m.buyer_id].forEach(identifier);integer(m.task_budget_minor,1,1_000_000_000);integer(m.max_single_minor,1,m.task_budget_minor);
  ensure(Array.isArray(m.allowed_sellers)&&m.allowed_sellers.length<=20,'SCHEMA_SELLERS');m.allowed_sellers.forEach(identifier);ensure(new Set(m.allowed_sellers).size===m.allowed_sellers.length,'DUPLICATE_SELLER');
  ensure(m.category==='RESEARCH_DATA'&&['ACTIVE','REVOKED'].includes(m.status),'SCHEMA_MANDATE');integer(m.created_at,0,9_000_000_000);integer(m.expires_at,m.created_at+1,9_000_000_000);
  if(Object.hasOwn(m,'task_requirements'))validateTaskRequirements(m.task_requirements);return structuredClone(m);
}
export function validateTaskRequirements(input:any):TaskRequirements {
  exact(input,['version','minimum_rows','required_columns','minimum_source_coverage','format','max_delivery_seconds',...(Object.hasOwn(input??{},'reference_dataset_id')?['reference_dataset_id']:[]),...(Object.hasOwn(input??{},'source_document_id')?['source_document_id','source_policy_hash']:[])]);ensure(input.version===1,'TASK_REQUIREMENTS_VERSION');
  const {version,max_delivery_seconds,...requirements}=input;validateRequirements(requirements);integer(max_delivery_seconds,1,3600);return structuredClone(input);
}
export const defaultTaskRequirements:TaskRequirements={version:1,minimum_rows:40,required_columns:['company','quarter','capex','currency','source_url'],minimum_source_coverage:.9,format:'JSON',max_delivery_seconds:180};
export const transitions:Record<State,State[]>={
  NEGOTIATING:['DEAL_PROPOSED','REJECTED','BLOCKED','EXPIRED'],DEAL_PROPOSED:['DEAL_ACCEPTED','REJECTED','BLOCKED','EXPIRED'],
  DEAL_ACCEPTED:['PREVIEW_REQUIRED','POLICY_APPROVED','BLOCKED','EXPIRED'],PREVIEW_REQUIRED:['PREVIEW_VERIFIED','BLOCKED','EXPIRED'],PREVIEW_VERIFIED:['POLICY_APPROVED','BLOCKED','EXPIRED'],
  POLICY_APPROVED:['ESCROW_FUNDED','PREVIEW_REQUIRED','BLOCKED','EXPIRED'],ESCROW_FUNDED:['DELIVERY_SUBMITTED','REFUNDED'],DELIVERY_SUBMITTED:['DELIVERY_VERIFIED','REFUNDED'],DELIVERY_VERIFIED:['SETTLED','REFUNDED'],
  SETTLED:[],REJECTED:[],BLOCKED:[],REFUNDED:[],EXPIRED:[],
};
export function transition(from:State,to:State){ensure(transitions[from]?.includes(to),'INVALID_STATE_TRANSITION');return to;}
export type Check={name:string;pass:boolean;actual:unknown;expected:unknown};
export function policy(m:Mandate,d:Deal,{time=now(),spent=0,reserved=0,dealHash=hash(d),previewRequired=false,previewVerified=false}={}):Check[]{
  validateMandate(m);validateDeal(d);
  return [
    {name:'MANDATE_ACTIVE',pass:m.status==='ACTIVE',actual:m.status,expected:'ACTIVE'},
    {name:'MANDATE_NOT_EXPIRED',pass:time<m.expires_at,actual:time,expected:m.expires_at},
    {name:'DEAL_NOT_EXPIRED',pass:time<d.expires_at,actual:time,expected:d.expires_at},
    {name:'BUYER_ALLOWED',pass:d.buyer_id===m.buyer_id,actual:d.buyer_id,expected:m.buyer_id},
    {name:'SELLER_ALLOWED',pass:m.allowed_sellers.length===0||m.allowed_sellers.includes(d.seller_id),actual:d.seller_id,expected:m.allowed_sellers},
    {name:'MAX_SINGLE',pass:d.price_minor<=m.max_single_minor,actual:d.price_minor,expected:m.max_single_minor},
    {name:'TASK_BUDGET',pass:spent+reserved+d.price_minor<=m.task_budget_minor,actual:spent+reserved+d.price_minor,expected:m.task_budget_minor},
    {name:'DEAL_HASH',pass:hash(d)===dealHash,actual:hash(d),expected:dealHash},
    ...(m.task_requirements?[
      {name:'TASK_MINIMUM_ROWS',pass:d.requirements.minimum_rows>=m.task_requirements.minimum_rows,actual:d.requirements.minimum_rows,expected:m.task_requirements.minimum_rows},
      {name:'TASK_SOURCE_COVERAGE',pass:d.requirements.minimum_source_coverage>=m.task_requirements.minimum_source_coverage,actual:d.requirements.minimum_source_coverage,expected:m.task_requirements.minimum_source_coverage},
      {name:'TASK_REQUIRED_COLUMNS',pass:m.task_requirements.required_columns.every(c=>d.requirements.required_columns.includes(c)),actual:d.requirements.required_columns,expected:m.task_requirements.required_columns},
      {name:'TASK_DELIVERY_WINDOW',pass:d.deadline<=m.task_requirements.max_delivery_seconds,actual:d.deadline,expected:m.task_requirements.max_delivery_seconds},
      ...(m.task_requirements.reference_dataset_id?[{name:'TASK_REFERENCE_DATASET',pass:d.requirements.reference_dataset_id===m.task_requirements.reference_dataset_id,actual:d.requirements.reference_dataset_id??null,expected:m.task_requirements.reference_dataset_id}]:[]),
      ...(m.task_requirements.source_document_id?[{name:'TASK_SOURCE_DOCUMENT',pass:d.requirements.source_document_id===m.task_requirements.source_document_id&&d.requirements.source_policy_hash===m.task_requirements.source_policy_hash,actual:{id:d.requirements.source_document_id??null,policy_hash:d.requirements.source_policy_hash??null},expected:{id:m.task_requirements.source_document_id,policy_hash:m.task_requirements.source_policy_hash}}]:[]),
    ]:[]),
    {name:'PREVIEW_REQUIRED',pass:!previewRequired||previewVerified,actual:previewVerified,expected:previewRequired},
  ];
}
export function requirePolicy(checks:Check[]){const failed=checks.find(c=>!c.pass);ensure(!failed,failed?.name??'POLICY_FAILED');}
export function freeze<T>(value:T):T {if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
