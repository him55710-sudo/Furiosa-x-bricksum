export const columns=['company','quarter','capex','currency','source_url'];
export const phases=['Brief','Agreement','Work','Review','Receipt'];
export const phaseOf=job=>({DRAFT:0,QUOTED:1,BLOCKED:1,FUNDING:1,LOCKED:2,REVIEW:3,SETTLING:3,REFUNDING:3,COMPLETED:4,REFUNDED:4,CANCELLED:4}[job?.status]??0);
export const statusLabel=status=>({DRAFT:'Ready to negotiate',QUOTED:'Negotiating',BLOCKED:'Protected',FUNDING:'Confirm funding',LOCKED:'Agreement locked',REVIEW:'Review delivery',SETTLING:'Confirm payment',REFUNDING:'Confirm refund',COMPLETED:'Paid as agreed',REFUNDED:'Refunded',CANCELLED:'Cancelled'}[status]??status);
export const workerNames={'seller-a':'Atlas','seller-b':'Nexus','seller-c':'Orbit'};
export function parseSource(raw){
 if(typeof raw!=='string'||raw.length>1_000_000)throw Error('Use a CSV or JSON file smaller than 1 MB.');
 let rows;
 if(raw.trim().startsWith('[')){try{rows=JSON.parse(raw);}catch{throw Error('The JSON is not valid. Upload an array of data rows.');}}
 else {
  const records=[];let row=[],cell='',quoted=false;
  const text=raw.replace(/^\uFEFF/,'');
  for(let i=0;i<=text.length;i++){
   const ch=text[i];
   if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(!cell||quoted)quoted=!quoted;else throw Error('Check the quotes in your CSV.');}
   else if((ch===','||ch==='\n'||ch===undefined)&&!quoted){row.push(cell.replace(/\r$/,''));cell='';if(ch!==','){if(row.some(x=>x.trim()))records.push(row);row=[];}}
   else if(ch!==undefined)cell+=ch;
  }
  if(quoted)throw Error('A CSV field has an unclosed quote.');
  const headers=records.shift()?.map(x=>x.trim().toLowerCase())??[];
  if(new Set(headers).size!==headers.length)throw Error('CSV column names must be unique.');
  if(!columns.every(c=>headers.includes(c)))throw Error('Include company, quarter, capex, currency and source_url columns.');
  if(records.some(r=>r.length!==headers.length))throw Error('Each CSV row must have the same number of columns as the header.');
  rows=records.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])));
 }
 if(!Array.isArray(rows)||rows.length<1||rows.length>1000)throw Error('Provide between 1 and 1,000 data rows.');
 if(rows.some(r=>!r||typeof r!=='object'||Array.isArray(r)||!columns.every(c=>Object.hasOwn(r,c))))throw Error('Each row needs company, quarter, capex, currency and source_url.');
 if(rows.some(r=>['company','quarter','currency','source_url'].some(k=>typeof r[k]!=='string')||!['string','number'].includes(typeof r.capex)||!String(r.capex).trim()))throw Error('Use text for names, quarters, currencies and source URLs, and a nonempty numeric CAPEX value.');
 return rows.map(r=>Object.fromEntries([...columns,'unit','source_page','source_sha256','source_label','source_value'].filter(k=>Object.hasOwn(r,k)).map(k=>[k,r[k]])));
}
export function normalizeRows(rows){
 const numeric=v=>typeof v==='number'?v:/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(String(v).trim())?Number(String(v).replace(/,/g,'').trim()):NaN;
 return rows.map(r=>({...r,company:String(r.company).trim().replace(/\s+/g,' '),quarter:String(r.quarter).trim().toUpperCase(),currency:String(r.currency).trim().toUpperCase(),capex:numeric(r.capex),source_url:String(r.source_url).trim()}));
}
export function offersFor(count){return [
 {seller:'seller-a',name:'Atlas',role:'Source-aware data worker',price:14+count*2,floor:12+count*2,description:'Normalize the table, preserve source references and compare every result with your input.'},
 {seller:'seller-b',name:'Nexus',role:'Fast delivery',price:27+count*2,floor:22+count*2,deliveryMinutes:4,description:'A speed-first worker that prioritizes short delivery windows and margin.'},
 {seller:'seller-c',name:'Orbit',role:'Premium research',price:19+count*2,floor:16+count*2,deliveryMinutes:6,description:'A quality-first worker that preserves the complete source metadata with every row.'}
 ];}
export function csv(rows){const keys=[...columns,...['unit','source_page','source_sha256','source_label','source_value'].filter(k=>rows.some(r=>r&&Object.hasOwn(r,k)))];const cell=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};return [keys.join(','),...rows.map(r=>keys.map(k=>cell(r?.[k])).join(','))].join('\r\n');}
