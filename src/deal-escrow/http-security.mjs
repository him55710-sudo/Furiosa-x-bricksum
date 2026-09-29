import {timingSafeEqual} from 'node:crypto';

export const LOCAL_CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
export function securityHeaders(res,csp=LOCAL_CSP){
 res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Cross-Origin-Resource-Policy':'same-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()','Content-Security-Policy':csp});
}
// Loopback is an operator boundary, not authentication for a public service.
// Reject DNS rebinding, foreign ports, cross-origin reads and browser subresources.
export function localBoundary({port,readOnly=false,csp=LOCAL_CSP}){
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('INVALID_LISTEN_PORT');
 const hosts=new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
 return (req,res,next)=>{
  securityHeaders(res,csp);
  if(!hosts.has(req.headers.host))return res.status(403).json({error:'LOCAL_HOST_REQUIRED'});
  const expected=`http://${req.headers.host}`;
  if(req.headers.origin&&req.headers.origin!==expected)return res.status(403).json({error:'SAME_ORIGIN_REQUIRED'});
  if(['cross-site','same-site'].includes(req.headers['sec-fetch-site']))return res.status(403).json({error:'SAME_ORIGIN_REQUIRED'});
  if(readOnly&&!['GET','HEAD'].includes(req.method))return res.status(405).set('Allow','GET, HEAD').end();
  next();
 };
}
export function localSession(token){
 const expected=Buffer.from(token);
 return (req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(['GET','HEAD'].includes(req.method))return next();
  const supplied=req.headers['x-ade-token'];
  if(typeof supplied!=='string'||Buffer.byteLength(supplied)!==expected.length||!timingSafeEqual(Buffer.from(supplied),expected)||req.headers.origin!==`http://${req.headers.host}`)return res.status(403).json({error:'LOCAL_SESSION_REQUIRED'});
  if(!req.is('application/json'))return res.status(415).json({error:'JSON_REQUIRED'});
  next();
 };
}
