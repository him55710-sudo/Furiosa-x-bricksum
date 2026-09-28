import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const checks=[];
try {
 await page.goto('http://127.0.0.1:3410/?replay=1');
 await page.getByRole('button',{name:'01 의뢰',exact:true}).waitFor();
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:844});
  for(const [button,title] of [['01 의뢰','AI에게 일을 맡겼다. 돈은 언제 보내야 할까?'],['05 환불','40행을 약속했는데, 7행?'],['06 다음 거래','이 실패가, 다음 거래를 바꿉니다.'],['08 효율','협상에는 AI. 검증에는 코드.']]){
   await page.getByRole('button',{name:button,exact:true}).click();await page.getByRole('heading',{name:title,exact:true}).waitFor();
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);assert.equal(overflow,false);checks.push({width,button,overflow});
  }
 }
 assert.deepEqual(errors,[]);writeFileSync('artifacts/deal-escrow/public-ui/automated-browser-checks.json',JSON.stringify({checked_at:new Date().toISOString(),checks,errors},null,2));
}finally{await browser.close();}
