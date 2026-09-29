// Local teaching model only: never an authorization or signing API.
export function simulatePolicy({priceMinor,remainingMinor,perDealMinor,allowedSeller,active,previewRequired,previewPassed}) {
 const checks=[
  {label:'Valid amount',code:'INVALID_AMOUNT',pass:Number.isSafeInteger(priceMinor)&&priceMinor>0},
  {label:'Active buyer authority',code:'AUTHORITY_INACTIVE',pass:active===true},
  {label:'Approved counterparty',code:'SELLER_NOT_ALLOWED',pass:allowedSeller===true},
  {label:'Per-payment limit',code:'PER_DEAL_LIMIT',pass:priceMinor<=perDealMinor},
  {label:'Remaining allocation authority',code:'TOTAL_LIMIT',pass:priceMinor<=remainingMinor},
  {label:'Required delivery preview',code:'PREVIEW_REQUIRED',pass:!previewRequired||previewPassed===true},
 ];
 return {allowed:checks.every(c=>c.pass),checks,mode:'LOCAL_SIMULATION',signedTransactions:0};
}

// The historical receipts store internal minor units. Never relabel those as ETH.
export function minorToWei(minor,unitWei){
 if(!Number.isSafeInteger(minor)||minor<0||!/^\d+$/.test(String(unitWei))||BigInt(unitWei)<=0n)throw Error('INVALID_CURRENCY_SCALE');
 return BigInt(minor)*BigInt(unitWei);
}
export function formatNativeAmount(minor,unitWei,unit='gwei'){
 const wei=minorToWei(minor,unitWei),places=unit==='ETH'?18:unit==='gwei'?9:null;
 if(places===null)throw Error('UNSUPPORTED_DISPLAY_UNIT');
 const divisor=10n**BigInt(places),whole=(wei/divisor).toString().replace(/\B(?=(\d{3})+(?!\d))/g,','),fraction=(wei%divisor).toString().padStart(places,'0').replace(/0+$/,'');
 return whole+(fraction?'.'+fraction:'');
}
export function gweiInputToMinor(value,unitWei){
 const input=String(value).trim();
 if(!/^\d+(\.\d{1,9})?$/.test(input)||!/^\d+$/.test(String(unitWei))||BigInt(unitWei)<=0n)return NaN;
 const [whole,fraction='']=input.split('.'),wei=BigInt(whole)*1000000000n+BigInt(fraction.padEnd(9,'0'));
 if(wei%BigInt(unitWei)!==0n)return NaN;
 const minor=wei/BigInt(unitWei);return minor<=BigInt(Number.MAX_SAFE_INTEGER)?Number(minor):NaN;
}
