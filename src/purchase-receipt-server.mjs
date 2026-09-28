import express from 'express';
const port=Number(process.env.PURCHASE_RECEIPT_PORT??3602),app=express();
app.disable('x-powered-by');
app.use((req,res,next)=>{
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))return res.sendStatus(403);
  res.set({'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'none'; frame-ancestors 'none'; base-uri 'none'"});next();
});
// Only intentionally public evidence directories. Never serve artifacts/private.
app.use('/purchase',express.static('artifacts/purchase',{dotfiles:'deny'}));
app.use('/purchase-sepolia',express.static('artifacts/purchase-sepolia',{dotfiles:'deny'}));
app.listen(port,'127.0.0.1',()=>console.log(`Receipt preview: http://127.0.0.1:${port}`));
