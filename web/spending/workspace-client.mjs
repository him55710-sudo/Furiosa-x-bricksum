export const executionMode='local';
export async function request(url,body,token){
 const response=await fetch(url,{...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-ADE-Token':token},body:JSON.stringify(body)})});
 const result=await response.json().catch(()=>({error:'The workspace server is unavailable. Start it with pnpm ade:spending:view.'}));
 if(!response.ok)throw Error(result.error??'The request could not complete.');return result;
}
