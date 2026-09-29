let csrf;
export async function liveRequest(body,id){
 if(body&&!csrf)await liveRequest();
 const response=await fetch('/api/live'+(id?'?id='+encodeURIComponent(id):''),{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json','X-Accord-Live-Token':csrf},body:JSON.stringify(body)}:{})});
 const result=await response.json().catch(()=>({error:'LIVE_SERVICE_UNAVAILABLE'}));
 if(!response.ok)throw Error(result.error??'LIVE_SERVICE_UNAVAILABLE');
 if(result.csrf)csrf=result.csrf;
 return result;
}
