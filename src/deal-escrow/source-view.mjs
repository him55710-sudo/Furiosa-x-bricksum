import {documentCatalog,sourceDescriptor,sourceDocument,sourceRequirements,citedSourceRows} from './source-document.ts';
import {documentOffers,publicOffers} from './research.ts';
export const sourceCatalogView=()=>documentCatalog.map(d=>({...d,label:d.id.replace('lges-','LGES ').replace('-pdf','').toUpperCase()}));
export function sourceView(id){
 const document=sourceDescriptor(id);
 try{const table=sourceDocument(id);return {ready:true,document,requirements:sourceRequirements(id),offers:publicOffers(documentOffers(id)),rows:citedSourceRows(id),cells:table.target_cells.map(c=>({id:c.id,period:c.period,text:c.text,box:c.box})),parser:table.parser,index_digest:table.index_digest,local_extraction:{model_calls:0,payment:false},human_review:'PENDING'};}
 catch(error){return {ready:false,document,reason:/^[A-Z_]+$/.test(error.message)?error.message:'SOURCE_READER_UNAVAILABLE',human_review:'PENDING'};}
}
