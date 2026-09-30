import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';

const equal=(a,b)=>typeof a==='string'&&/^[a-f0-9]{64}$/.test(a)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function liveHandler({service,secret,configured=true,secure=true}){
 const mac=value=>createHmac('sha256',secret).update(value).digest('hex');
 return async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const send=(status,body)=>res.status(status).json(body);
  const host=req.headers.host,origin=req.headers.origin,expected=(secure?'https://':'http://')+host;
  if((origin&&origin!==expected)||req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'LIVE_ORIGIN_DENIED'});
  if(!configured)return send(503,{available:false,error:'LIVE_SERVICE_NOT_CONFIGURED'});
  const cookie=String(req.headers.cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith('accord_live='))?.slice(12);
  let [owner,signature]=cookie?.split('.')??[];
  if(!/^[a-f0-9]{64}$/.test(owner??'')||!equal(signature,mac('cookie:'+owner))){
   if(req.method!=='GET')return send(401,{error:'LIVE_SESSION_COOKIE_REQUIRED'});
   owner=randomBytes(32).toString('hex');
   res.setHeader('Set-Cookie',`accord_live=${owner}.${mac('cookie:'+owner)}; Path=/api/live; HttpOnly; SameSite=Strict; Max-Age=86400${secure?'; Secure':''}`);
  }
  const csrf=mac('csrf:'+owner);
  try{
   if(req.method==='GET'){
    const url=new URL(req.url,expected),id=url.searchParams.get('id');
    const state=await service.state(owner,id);
    if(id&&url.searchParams.get('download')==='1'){
     res.setHeader('Content-Disposition','attachment; filename="accord-live-evidence.json"');
     return send(200,{schema:'ACCORD_LIVE_EXPORT_V1',exportedAt:new Date().toISOString(),...state});
    }
    return send(200,{...state,csrf});
   }
   if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return send(405,{error:'LIVE_METHOD_NOT_ALLOWED'});}
   if(origin!==expected||!equal(req.headers['x-accord-live-token'],csrf))return send(403,{error:'LIVE_REQUEST_TOKEN_REQUIRED'});
   if(!String(req.headers['content-type']).startsWith('application/json'))return send(415,{error:'LIVE_JSON_REQUIRED'});
   const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
   if(!body||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body))>16000)return send(413,{error:'LIVE_REQUEST_TOO_LARGE'});
   return send(200,await service.execute(owner,body));
  }catch(error){
   const safe=/^[A-Z0-9_]{3,100}$/.test(error.message)?error.message:'LIVE_SERVICE_UNAVAILABLE';
   return send(/LIMIT/.test(safe)?429:/REVOKED|CHANGED|PROGRESS|BUSY|USED|AUTHORIZED/.test(safe)?409:400,{error:safe});
  }
 };
}
