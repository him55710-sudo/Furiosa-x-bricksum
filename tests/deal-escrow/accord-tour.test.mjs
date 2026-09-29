import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TOUR_SCENES,tourPosition,createTourRenderer} from '../../web/spending/accord-tour.mjs';

const names=['report','normal','over-limit','wrong-delivery','preview-first','app-off','buyer-transactions','buyer-refund'];
const data=Object.fromEntries(names.map(name=>[name,JSON.parse(readFileSync(`artifacts/deal-escrow/spending-proof/${name}.json`))]));
const render=createTourRenderer({data,amount:n=>`${n} gwei`,icon:name=>`<svg data-icon="${name}"></svg>`});
const txLink=hash=>`href="https://sepolia.etherscan.io/tx/${hash}"`;

test('the presentation covers exactly 180 seconds with continuous chapters and a stable ending',()=>{
 assert.equal(TOUR_SCENES[0].at,0);
 assert.equal(TOUR_SCENES.at(-1).end,180);
 for(let i=0;i<TOUR_SCENES.length;i++){
  const scene=TOUR_SCENES[i];
  assert.equal(tourPosition(scene.at).chapter,i);
  assert.equal(tourPosition(scene.end-.001).chapter,i);
  if(i)assert.equal(TOUR_SCENES[i-1].end,scene.at);
 }
 assert.deepEqual(tourPosition(-10),tourPosition(0));
 assert.deepEqual(tourPosition(NaN),tourPosition(0));
 assert.deepEqual(tourPosition(250),tourPosition(180));
 assert.equal(tourPosition(180).complete,true);
 assert.equal(tourPosition(179.99).complete,false);
 assert.equal(tourPosition(180).chapter,5);
});

test('the trading story reveals funding and release evidence only after the respective events',()=>{
 const funded=txLink(data.normal.transactions.fund.tx_hash),paid=txLink(data.normal.transactions.release.tx_hash);
 for(const second of [45,52.5,59.9])assert.equal(render.frame(second).includes(funded),false);
 for(const second of [60,67.5,75,82.49]){
  const html=render.frame(second);assert.ok(html.includes(funded));assert.equal(html.includes(paid),false);
  assert.ok(html.includes('LOCKED · 보관 중'));
 }
 const html=render.frame(82.5);assert.ok(html.includes(paid));assert.ok(html.includes('판매자 지갑'));
 assert.ok(html.includes('계약은 데이터의 정확성을 스스로 판정하지 않습니다.'));
});

test('a blocked request never becomes the illustrated buyer budget',()=>{
 const html=render.frame(44);
 assert.ok(html.includes(`구매자 예산 계약</strong><span class="at-vault-value">${data.report.deposit_minor} gwei`));
 assert.ok(html.includes(`${data['over-limit'].deal.price_minor} gwei 요청 → 예치 전에 차단`));
 assert.ok(html.includes('정책에서 먼저 거절 · 예치 서명 0건'));
});

test('failure memory and app-off recovery show their distinct actual settlement records',()=>{
 const refund=txLink(data['wrong-delivery'].transactions.refund.tx_hash);
 const next=txLink(data['preview-first'].transactions.fund.tx_hash);
 assert.equal(render.frame(90).includes(refund),false);
 assert.ok(render.frame(99).includes(refund));
 assert.equal(render.frame(115).includes(next),false);
 assert.ok(render.frame(117).includes(next));
 const direct=txLink(data['buyer-refund'].tx_hash);
 assert.equal(render.frame(144).includes(direct),false);
 assert.ok(render.frame(145).includes(direct));
 assert.ok(render.frame(145).includes('자동 환불이 아니며'));
 assert.ok(render.frame(145).includes('기한 후 별도 도구로 회수'));
});
