import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
export const documentCatalog=Object.freeze(JSON.parse(readFileSync(new URL('../../data/reference/capex/source-documents.json',import.meta.url),'utf8')).documents.map(d=>Object.freeze(d)));
export const sourcePolicyHash=id=>{const d=documentCatalog.find(d=>d.id===id);if(!d)throw new Error('UNKNOWN_SOURCE_DOCUMENT');const {human_review,...policy}=d;return '0x'+createHash('sha256').update(JSON.stringify(policy)).digest('hex');};
