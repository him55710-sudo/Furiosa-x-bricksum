import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ensure,hash,freeze} from './domain.ts';
import type {Check,TaskRequirements} from './domain.ts';

// Only reviewed, versioned repository data is loaded. Seller input is never a file path.
const bytes=readFileSync(new URL('../../data/reference/capex/lges-2025-v1.json',import.meta.url));
export const reference=freeze(JSON.parse(bytes.toString('utf8')));
export const referenceFileSha256=createHash('sha256').update(bytes).digest('hex');
export const referenceDigest=hash(reference);
export const sourcePacket=freeze(JSON.parse(readFileSync(new URL('../../data/reference/capex/lges-2025-source-packet.json',import.meta.url),'utf8')));
export const referenceColumns=['company','quarter','capex','currency','source_url','unit','source_page','source_sha256','source_label','source_value'];
export const researchRequirements:TaskRequirements={version:1,minimum_rows:4,required_columns:referenceColumns,minimum_source_coverage:1,format:'JSON',max_delivery_seconds:180,reference_dataset_id:reference.id};
export function referenceRows(){return reference.records.map((r:any)=>({...r,source_url:reference.source.url,source_page:reference.source.pdf_page,source_sha256:reference.source.sha256,source_label:reference.source.row_label}));}
export function referenceChecks(rows:any[],id:string):Check[]{
  ensure(id===reference.id,'UNKNOWN_REFERENCE_DATASET');
  const known=rows.every(row=>reference.records.some((r:any)=>r.company===row?.company&&r.quarter===row?.quarter));
  const match=(row:any)=>reference.records.find((r:any)=>r.company===row?.company&&r.quarter===row?.quarter);
  const values=known&&rows.every(row=>{const r=match(row);return row.capex===r.capex&&row.source_value===r.source_value;});
  const units=rows.every(row=>row?.currency==='KRW'&&row?.unit==='billion');
  const sources=rows.every(row=>row?.source_url===reference.source.url&&row?.source_page===reference.source.pdf_page&&row?.source_sha256===reference.source.sha256&&row?.source_label===reference.source.row_label);
  const complete=rows.length===reference.records.length&&reference.records.every((r:any)=>rows.some(row=>row?.company===r.company&&row?.quarter===r.quarter));
  return [
    {name:'REFERENCE_PERIODS',pass:known&&complete,actual:rows.map(r=>r?.quarter??null),expected:reference.records.map((r:any)=>r.quarter)},
    {name:'REFERENCE_VALUES',pass:values,actual:values,expected:'positive quarterly facility-investment outflow and original negative source value'},
    {name:'REFERENCE_UNIT',pass:units,actual:units,expected:'billion KRW'},
    {name:'REFERENCE_PROVENANCE',pass:sources,actual:sources,expected:{url:reference.source.url,page:reference.source.pdf_page,sha256:reference.source.sha256,row:reference.source.row_label}},
  ];
}
