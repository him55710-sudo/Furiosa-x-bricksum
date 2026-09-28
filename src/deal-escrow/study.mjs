import {mkdirSync,existsSync,readFileSync,appendFileSync} from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
export const studyQuestions=[
  {id:'user_and_problem',label:'누가 어떤 상황에서 이 제품을 쓰나요? 본인 말로 설명해 주세요.'},
  {id:'ai_decision',label:'AI가 결정한 부분과 코드가 결정한 부분은 각각 무엇이었나요?'},
  {id:'payment_reason',label:'환불된 거래와 지급된 거래에는 어떤 차이가 있었나요?'},
  {id:'remaining_trust',label:'이 제품이 보장하지 못하는 것은 무엇이라고 이해했나요?'},
  {id:'confusing_moment',label:'헷갈렸거나 믿기 어려웠던 화면·설명은 무엇이었나요?'},
  {id:'recent_incident',label:'리서치·유료 API·에이전트 업무를 한다면, 최근 실제로 겪은 관련 문제 한 건과 당시 해결 방법·시간·비용을 알려주세요. 경험이 없으면 없다고 적어주세요.'},
  {id:'reference_review',label:'공식 보고서 16쪽의 2025 Q1~Q4 시설투자 행과 표의 숫자·부호·단위를 대조해 보세요. 일치 여부와 발견한 차이를 적어주세요.'},
];
export function mountStudy(app,directory){
  const file=path.join(directory,'human-study','responses.jsonl'),read=()=>existsSync(file)?readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(s=>JSON.parse(s)):[];
  app.get('/api/study',(_req,res)=>{const latest=new Map(read().map(r=>[r.participant_id,r])),rows=[...latest.values()];res.json({questions:studyQuestions,counts:{self_reported_humans:rows.filter(r=>r.participant_kind==='human').length,newcomers:rows.filter(r=>r.participant_kind==='human'&&r.newcomer).length,practitioners:rows.filter(r=>r.participant_kind==='human'&&r.practitioner).length,automated_qa:rows.filter(r=>r.participant_kind==='automated_qa').length},status:'Responses require provenance and qualitative review; counts alone are not a successful study.'});});
  app.post('/api/study',(req,res)=>{
    const b=req.body;if(!b||Object.keys(b).sort().join('|')!==['participant_id','participant_kind','newcomer','practitioner','consent','answers'].sort().join('|')||!/^[A-Za-z0-9_-]{1,40}$/.test(b.participant_id)||!['human','automated_qa'].includes(b.participant_kind)||typeof b.newcomer!=='boolean'||typeof b.practitioner!=='boolean'||b.consent!==true||!b.answers||Object.keys(b.answers).sort().join('|')!==studyQuestions.map(q=>q.id).sort().join('|')||Object.values(b.answers).some(v=>typeof v!=='string'||v.trim().length===0||v.length>4000))return res.status(400).json({error:'INVALID_STUDY_RESPONSE'});
    const showcase='artifacts/deal-escrow/research/latest-showcase.json';if(!existsSync(showcase))return res.status(409).json({error:'SHOWCASE_NOT_READY'});
    const record={...b,received_at:new Date().toISOString(),provenance:b.participant_kind==='human'?'Participant self-report; human identity not independently authenticated':'Automated QA; exclude from human validation',showcase_sha256:createHash('sha256').update(readFileSync(showcase)).digest('hex')};mkdirSync(path.dirname(file),{recursive:true});appendFileSync(file,JSON.stringify(record)+'\n');res.json({saved:true,participant_id:b.participant_id,human_validation_complete:false});
  });
}
