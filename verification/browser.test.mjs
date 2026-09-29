import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {title} from './catalog.mjs';
import {lab,evidence} from './helpers.mjs';

test(title('BROWSER-001'),{timeout:150000},async t=>{
  // Always build the source under test; a stale dist must not pass this gate.
  for(const args of [['node_modules/typescript/bin/tsc','--noEmit'],['node_modules/vite/bin/vite.js','build']])execFileSync(process.execPath,args,{stdio:'pipe',timeout:60000});
  const l=await lab(t),http=await l.http();
  const channel=process.env.CONTROL_VERIFY_BROWSER_CHANNEL??(process.platform==='win32'?'msedge':undefined);
  const browser=await chromium.launch({headless:true,...(channel?{channel}:{})});
  const context=await browser.newContext({viewport:{width:1440,height:1050},acceptDownloads:true});
  await context.route('**/*',route=>new URL(route.request().url()).origin===http.origin?route.continue():route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.setDefaultTimeout(15000);
  const dir=path.join(process.env.CONTROL_VERIFY_DIR??l.dir,'evidence');await mkdir(dir,{recursive:true});
  try{
    await page.goto(http.origin);await page.getByRole('button',{name:'예산 위임',exact:true}).waitFor();
    await page.getByRole('button',{name:'예산 위임',exact:true}).click();
    const approval=page.getByRole('dialog');
    await approval.getByRole('button',{name:'승인 내용 확인'}).click();
    await approval.getByRole('button',{name:'승인 창 닫기'}).click();
    await page.getByRole('button',{name:'에이전트 예산',exact:true}).click();
    await page.getByRole('button',{name:'승인 내용 보기',exact:true}).click();
    await approval.getByRole('button',{name:'서명하고 예산 위임'}).click();
    await page.getByRole('button',{name:'구매 실행',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'구매 실행',exact:true}).click();
    const drawer=page.getByRole('dialog');
    await drawer.getByText('결제 완료',{exact:true}).waitFor();
    await drawer.getByRole('button',{name:'승인과 증빙',exact:true}).click();
    await drawer.getByRole('button',{name:'기록 검증',exact:true}).click();
    await drawer.getByText('검증 통과',{exact:true}).waitFor();
    await drawer.getByTestId('chain-observation').waitFor();
    assert.match(await drawer.getByTestId('verification-scope').innerText(),/세션 지출·예약·상태 요약은 검증 대상이 아닙니다/);
    // Make the evidence level visible in every saved demo screenshot.
    await page.evaluate(()=>{const banner=document.createElement('div');banner.textContent='검증 데모 · 모델 응답은 합성 fixture · HTTP / 서명 / 로컬 EVM은 실제 실행';banner.style.cssText='position:fixed;bottom:0;left:0;right:0;padding:10px;background:#102c42;color:#fff;z-index:99999;text-align:center;font:14px sans-serif';document.body.append(banner);});
    await page.screenshot({path:path.join(dir,'browser-payment.png'),fullPage:true});
    const downloading=page.waitForEvent('download');await drawer.getByRole('button',{name:'증빙 받기',exact:true}).click();
    const download=await downloading;const file=path.join(dir,'browser-bundle.json');await download.saveAs(file);
    const bundle=JSON.parse(await readFile(file,'utf8'));assert.equal(bundle.run.status,'SETTLED');
    assert.equal((await http.request('/api/verify',{method:'POST',body:bundle})).body.status,'VALID');
    await drawer.getByRole('button',{name:'금액 변조 실험'}).click();
    await drawer.getByText('변조 / 불일치',{exact:true}).waitFor();await page.screenshot({path:path.join(dir,'browser-tamper.png'),fullPage:true});
    await page.getByRole('button',{name:'거래 상세 닫기'}).click();
    await page.getByRole('button',{name:'에이전트 예산',exact:true}).click();
    // Polling can render local STOPPED before the revoke transaction is mined.
    // Require the stop response and confirmed receipt before checking chain state.
    const stopping=page.waitForResponse(response=>response.url()===`${http.origin}/api/sessions/${bundle.session.id}/stop`&&response.request().method()==='POST');
    await page.getByRole('button',{name:'중지',exact:true}).click();
    const stopped=await stopping;assert.equal(stopped.status(),200);
    assert.equal((await stopped.json()).revocation?.status,1,'stop must return a mined successful revocation');
    await page.getByText('중지됨',{exact:true}).waitFor();
    assert.equal(await l.chain.vault.active(bundle.session.id),false);
    assert.deepEqual(errors,[],'browser runtime errors');
    await evidence('browser-demo',{evidenceLevel:'SYNTHETIC_MODEL_REAL_BROWSER_HTTP_LOCAL_EVM',browser:browser.version(),status:'PASS',runId:bundle.run.id,txHash:bundle.run.receipt.hash,stages:['render','wallet_login','approval_form','wallet_signature','purchase','receipt','verification','download','tamper_rejection','revocation'],consoleErrors:errors});
  }catch(e){await page.screenshot({path:path.join(dir,'browser-failure.png'),fullPage:true}).catch(()=>{});throw e;}
  finally{await context.close();await browser.close();}
});
